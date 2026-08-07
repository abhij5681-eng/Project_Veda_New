import os
from google import genai
# Import our new local embedding function!
from db_services import get_supabase, get_embedding 

# Keep the Google Client ONLY for the actual AI chat responses
client = genai.Client(
    api_key=os.environ.get("GEMINI_API_KEY")
)

def generate_with_failover_stream(prompt):
    # ... keep this exactly as is ...
    response = client.models.generate_content_stream(
        model='gemini-3.5-flash-lite',
        contents=prompt
    )
    for chunk in response:
        if chunk.text:
            yield chunk.text

def ask_veda_stream(user_email, question, subject_name, chat_history):
    """The main chat function using Supabase pgvector for memory retrieval."""
    supabase = get_supabase()

    # ---------------------------------------------------------
    # Call the local model to convert the question into a vector
    # ---------------------------------------------------------
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
    
    # ... keep the rest of the function exactly as it is ...
    
    # 5. Check if we found documents
    if not results.data:
        yield f"I don't have any notes on '{subject_name}' in your personal records to answer this yet."
        return
        
    # 6. Inject the actual file names directly into the context text
    context_parts = []
    for row in results.data:
        doc_text = row['content']
        source_name = row['source']
        context_parts.append(f"--- START SOURCE: {source_name} ---\n{doc_text}\n--- END SOURCE ---")
        
    context = "\n\n".join(context_parts)
    
    history_text = ""
    if chat_history:
        # Only pass the last 4 messages to keep context focused and save tokens
        for msg in chat_history[-4:]:
            role = "Student" if msg["role"] == "user" else "Veda"
            history_text += f"{role}: {msg['content']}\n"
            
    prompt = f"""
    You are Veda, an experienced, warm, and dedicated human-like teacher holding a class with your student. 
    Speak naturally, encourage curiosity, use conversational phrasing, and show genuine enthusiasm for teaching. Never refer to yourself as an AI, a computer program, a model, or Gemini. 

    You must adhere strictly to these two behaviors:
    
    BEHAVIOR 1: CONVERSATIONAL & MENTORSHIP
    If the student is greeting you, asking how you are, or chatting casually, respond like a kind, supportive teacher checking in on their progress. Do not include citations for these messages.

    BEHAVIOR 2: ACADEMIC INSTRUCTION & QUIZ EVALUATION
    For factual questions or when grading quiz answers:
    - Answer using ONLY the provided textbook context below. 
    - If evaluating a quiz answer: if they are correct, compliment them warmly. If they are incorrect, politely explain the right answer and the underlying reason with patience and clarity.
    - If a factual question cannot be answered from the notes, kindly say: "I couldn't find that in your uploaded notes, but let me know if you'd like me to look at another topic!"

    CITATION INSTRUCTION (FOR BEHAVIOR 2 ONLY):
    If you used the textbook context to answer an academic question, you MUST list the specific source file(s) you actually used at the very end of your response. 
    Format it exactly like this: *(Sources: filename1.pdf, filename2.pdf)*

    Previous Conversation Context:
    {history_text if history_text else "No previous conversation."}

    Textbook Context ({subject_name}):
    {context}

    Student's Message: {question}
    """

    # 7. Stream the final chat response back to the frontend
    # 7. Stream the final chat response back to the frontend
    try:
        response = client.models.generate_content_stream(
            model='gemini-3.5-flash-lite',
            contents=prompt
        )
        for chunk in response:
            if chunk.text:
                yield chunk.text
    except Exception as e:
        # If Google's servers are busy or crash, Veda will gracefully tell you!
        error_msg = str(e)
        if "503" in error_msg:
            yield "\n\n*(System Note: Google's AI servers are currently experiencing heavy traffic. Please wait a moment and try asking again!)*"
        else:
            yield f"\n\n*(System Note: An AI connection error occurred: {error_msg})*"

    for chunk in response:
        if chunk.text:
            yield chunk.text