import os
import json
from typing import List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from google import genai
from google.genai import types
from db_services import get_supabase, get_subject_text,get_embedding
from datetime import datetime, timezone

router = APIRouter(prefix="/api/quiz", tags=["Quiz"])

class UpdateMasteryRequest(BaseModel):
    concept_id: str
    is_correct: bool

class ProactiveQuizRequest(BaseModel):
    user_email: str          
    workspace_id: str     
    language: str = "English"

# Pydantic Schemas
class QuizRequest(BaseModel):
    user_id: str          
    workspace_id: str     
    language: str = "English" 

class QuizResponse(BaseModel):
    question: str
    options: List[str]
    correct_answer: str
    concept_tested: str

@router.post("/generate", response_model=QuizResponse)
async def generate_quiz_question(request: QuizRequest):
    try:
        supabase = get_supabase()

        # 1. Fetch or Create Active Quiz Session
        session_response = supabase.table('quiz_sessions').select('*') \
            .eq('user_id', request.user_id) \
            .eq('workspace_id', request.workspace_id) \
            .eq('is_active', True).execute()
        
        if not session_response.data:
            new_session = supabase.table('quiz_sessions').insert({
                'user_id': request.user_id,
                'workspace_id': request.workspace_id
            }).execute()
            session_data = new_session.data[0]
        else:
            session_data = session_response.data[0]

        session_id = session_data['id']
        concepts_tested = session_data.get('concepts_tested', []) or []
        previous_questions = session_data.get('previous_questions', []) or []

        # 2. Retrieve Subject Context from Notes
        rag_context = get_subject_text(request.workspace_id, request.user_id)
        if not rag_context:
            raise HTTPException(status_code=400, detail="No study notes found in this workspace to generate a quiz.")

        # 3. Construct Strict JSON Prompt (With Language Injection)
        prompt = f"""
        You are an expert educational tutor generating a multiple-choice quiz question based on the provided material.
        
        Source Material:
        {rag_context[:30000]}
        
        Constraints:
        1. Generate EXACTLY ONE multiple-choice question testing the source material.
        2. DO NOT test any of these previously tested concepts: {concepts_tested}
        3. DO NOT repeat or substantially rephrase any of these previous questions: {previous_questions}
        4. Provide exactly 4 options.
        5. CRITICAL: The text for the question, options, and correct_answer MUST be translated and written in {request.language}.
        
        Return ONLY a raw JSON object matching this exact structure (You MUST keep the dictionary keys in English!):
        {{
            "question": "The translated question text in {request.language}",
            "options": ["Option A in {request.language}", "Option B in {request.language}", "Option C in {request.language}", "Option D in {request.language}"],
            "correct_answer": "The exact string matching the correct option from options array",
            "concept_tested": "A 2-4 word snake_case summary of the concept in English"
        }}
        """

        # 4. Call Gemini with Forced JSON Output
        client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
        response = client.models.generate_content(
            model='gemini-3.5-flash-lite',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            )
        )
        
        # 👇 THE FIX: Strip hidden markdown backticks before loading JSON
        raw_text = response.text.strip()
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:-3].strip()
        elif raw_text.startswith("```"):
            raw_text = raw_text[3:-3].strip()
            
        quiz_data = json.loads(raw_text)

        # 5. Update Session State in Supabase
        new_concepts = concepts_tested + [quiz_data['concept_tested']]
        new_questions = previous_questions + [quiz_data['question']]
        
        supabase.table('quiz_sessions').update({
            'concepts_tested': new_concepts,
            'previous_questions': new_questions
        }).eq('id', session_id).execute()

        return quiz_data

    except HTTPException:
        raise
    except Exception as e:
        print(f"Quiz Generation Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate quiz question: {str(e)}")

@router.post("/proactive")
async def generate_proactive_question(request: ProactiveQuizRequest):
    try:
        supabase = get_supabase()

        # 1. Find the highest priority concept (Untested or Weak, oldest test first)
        concept_res = supabase.table('concept_mastery').select('*') \
            .eq('user_email', request.user_email) \
            .eq('workspace_id', request.workspace_id) \
            .order('last_tested_at', desc=False, nullsfirst=True) \
            .limit(1).execute()

        if not concept_res.data:
            return {"status": "skip", "message": "No concepts extracted yet."}

        target_concept = concept_res.data[0]
        concept_name = target_concept['concept_name']

        # 2. Targeted Vector Search (Massively speeds up Gemini because we only send relevant text!)
        concept_embedding = get_embedding(concept_name)
        docs_res = supabase.rpc("match_veda_documents", {
            "query_embedding": concept_embedding,
            "match_email": request.user_email,
            "match_subject": request.workspace_id,
            "match_count": 2 # Only grab the 2 most relevant chunks
        }).execute()

        if not docs_res.data:
            return {"status": "skip", "message": "Concept text not found."}

        context = "\n\n".join([doc['content'] for doc in docs_res.data])

        # 3. Generate a hyper-focused question
        prompt = f"""
        You are an expert tutor. Create a multiple-choice question testing the specific concept: '{concept_name}'.
        
        Source Material:
        {context}
        
        Constraints:
        1. Generate EXACTLY ONE multiple-choice question.
        2. Provide exactly 4 options.
        3. CRITICAL: The question, options, and correct_answer MUST be in {request.language}.
        
        Return ONLY a raw JSON object matching this exact structure:
        {{
            "question": "The translated question text in {request.language}",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correct_answer": "The exact string matching the correct option",
            "concept_tested": "{concept_name}"
        }}
        """

        client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
        response = client.models.generate_content(
            model='gemini-3.5-flash-lite',
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        
        # Clean JSON markdown bug
        raw_text = response.text.strip()
        if raw_text.startswith("```json"): raw_text = raw_text[7:-3].strip()
        elif raw_text.startswith("```"): raw_text = raw_text[3:-3].strip()
            
        quiz_data = json.loads(raw_text)
        quiz_data['status'] = 'success'
        quiz_data['concept_id'] = target_concept['id'] # We need this to update their score later!

        return quiz_data

    except Exception as e:
        print(f"Proactive Generation Error: {e}")
        return {"status": "error", "detail": str(e)}
    
@router.post("/update-mastery")
async def update_concept_mastery(request: UpdateMasteryRequest):
    try:
        supabase = get_supabase()
        
        # 1. Fetch the current stats for this concept
        res = supabase.table('concept_mastery').select('*').eq('id', request.concept_id).execute()
        if not res.data:
            return {"status": "error", "message": "Concept not found"}
            
        concept = res.data[0]
        attempts = concept['total_attempts'] + 1
        corrects = concept['correct_count'] + (1 if request.is_correct else 0)
        
        # 2. Calculate their new mastery level
        accuracy = corrects / attempts
        if attempts < 2:
            status = "Moderate" if request.is_correct else "Weak"
        elif accuracy >= 0.8:
            status = "Strong"
        elif accuracy >= 0.5:
            status = "Moderate"
        else:
            status = "Weak"
            
        # 3. Save it to Veda's brain
        supabase.table('concept_mastery').update({
            'total_attempts': attempts,
            'correct_count': corrects,
            'status': status,
            'last_tested_at': datetime.now(timezone.utc).isoformat()
        }).eq('id', request.concept_id).execute()
        
        return {"status": "success", "new_level": status}
        
    except Exception as e:
        print(f"Mastery Update Error: {e}")
        return {"status": "error", "detail": str(e)}