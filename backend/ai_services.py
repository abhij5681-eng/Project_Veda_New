import os
from google import genai
from db_services import get_supabase, get_embedding 

# Keep the Google Client ONLY for the actual AI chat responses
client = genai.Client(
    api_key=os.environ.get("GEMINI_API_KEY")
)

def generate_with_failover_stream(prompt):
    response = client.models.generate_content_stream(
        model='gemini-3.5-flash-lite',
        contents=prompt
    )
    for chunk in response:
        if chunk.text:
            yield chunk.text

def ask_veda_stream(user_email, question, subject_name, chat_history, language="English"):
    """The main chat function using Supabase pgvector for memory retrieval."""
    
    # 👇 ADDED A LOGGING STATEMENT! This will show up in your Render Logs!
    print(f"🚀 VEDA TRIGGERED! Requested Language: {language}")
    
    supabase = get_supabase()

    # Call the local model to convert the question into a vector
    query_embedding = get_embedding(question)

    # Call our custom Supabase Search Function
    results = supabase.rpc(
        "match_veda_documents",
        {
            "query_embedding": query_embedding,
            "match_email": user_email,
            "match_subject": subject_name,
            "match_count": 4
        }
    ).execute()
    
    if not results.data:
        yield f"I don't have any notes on '{subject_name}' in your personal records to answer this yet."
        return
        
    context_parts = []
    for row in results.data:
        doc_text = row['content']
        source_name = row['source']
        context_parts.append(f"--- START SOURCE: {source_name} ---\n{doc_text}\n--- END SOURCE ---")
        
    context = "\n\n".join(context_parts)
    
    history_text = ""
    if chat_history:
        for msg in chat_history[-4:]:
            role = "Student" if msg["role"] == "user" else "Veda"
            history_text += f"{role}: {msg['content']}\n"
            
    # 👇 MASSIVELY UPDATED PROMPT TO PREVENT THE ENGLISH TEACHER HALLUCINATION
    prompt = f"""
    You are Veda, an experienced, warm, and dedicated human-like teacher.
    
    🚨 STRICT MULTILINGUAL DIRECTIVE 🚨
    You MUST speak, think, and respond completely in {language}. 
    Under NO circumstances are you allowed to tell the student to "stick to English." 
    Do NOT act like an English teacher. If the requested language is {language}, you are a native {language} teacher.
    Even though the Textbook Context below is written in English, you MUST translate your answers and explanations into {language}.

    BEHAVIOR 1: CONVERSATIONAL & MENTORSHIP
    If the student is greeting you, asking how you are, or chatting casually, respond like a kind, supportive teacher entirely in {language}. Do not include citations for these messages.

    BEHAVIOR 2: ACADEMIC INSTRUCTION & QUIZ EVALUATION
    Answer using ONLY the provided textbook context below. Translate the concepts into {language} so the student can understand them natively.
    If a factual question cannot be answered from the notes, politely state in {language} that you couldn't find it.

    CITATION INSTRUCTION (FOR BEHAVIOR 2 ONLY):
    If you used the textbook context to answer an academic question, you MUST list the specific source file(s) you actually used at the very end of your response. 
    Format it exactly like this: *(Sources: filename1.pdf, filename2.pdf)*

    Previous Conversation Context:
    {history_text if history_text else "No previous conversation."}

    Textbook Context ({subject_name}):
    {context}

    Student's Message: {question}
    """

    try:
        response = client.models.generate_content_stream(
            model='gemini-3.5-flash-lite',
            contents=prompt
        )
        for chunk in response:
            if chunk.text:
                yield chunk.text
    except Exception as e:
        error_msg = str(e)
        if "503" in error_msg:
            yield "\n\n*(System Note: Google's AI servers are currently experiencing heavy traffic. Please wait a moment and try asking again!)*"
        else:
            yield f"\n\n*(System Note: An AI connection error occurred: {error_msg})*"