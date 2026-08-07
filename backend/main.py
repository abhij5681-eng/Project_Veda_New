import os
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv

load_dotenv()

from db_services import (
    delete_workspace,
    process_pdf, 
    process_raw_text, 
    get_embedding, 
    get_supabase, 
    upload_to_supabase_storage,
    get_inventory,
    load_chat_history,
    save_chat_message,  
    get_subject_text,   
    delete_file         
)
from auth_services import hash_password, verify_password, generate_otp, send_otp_email
from ai_services import ask_veda_stream, generate_with_failover_stream

app = FastAPI(title="Project Veda API")

# --- PRODUCTION CORS SETUP ---
origins = [
    "http://localhost:5173",       
    "http://127.0.0.1:5173",
]

# Add the production frontend URL if it exists in the environment variables
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request Models
class LoginReq(BaseModel):
    email: str
    password: str

class SignupReq(BaseModel):
    email: str
    password: str

class VerifyOtpReq(BaseModel):
    email: str
    otp: str
    password: str

class ChatReq(BaseModel):
    user_email: str
    subject: str
    question: str

class ToolReq(BaseModel):
    user_email: str
    subject: str
    tool_type: str  # "quiz" or "summary"

class UpdateHistoryReq(BaseModel):
    user_email: str
    subject: str
    messages: list

# --- AUTH ENDPOINTS ---
@app.post("/api/auth/login")
def login(req: LoginReq):
    supabase = get_supabase()
    res = supabase.table("custom_users").select("*").eq("email", req.email).execute()
    if res.data and verify_password(req.password, res.data[0]["password_hash"]):
        return {"status": "success", "user_email": req.email}
    raise HTTPException(status_code=401, detail="Invalid credentials")

@app.post("/api/auth/send-otp")
def request_otp(req: SignupReq):
    supabase = get_supabase()
    existing = supabase.table("custom_users").select("email").eq("email", req.email).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Account already exists")
    
    otp = generate_otp()
    
    # Calculate an expiration time (10 minutes from now)
    expires = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    
    # Add expires_at to the database insert
    supabase.table("otp_requests").insert({
        "email": req.email, 
        "otp_code": otp,
        "expires_at": expires
    }).execute()
    
    if send_otp_email(req.email, otp):
        return {"message": "OTP sent successfully"}
    raise HTTPException(status_code=500, detail="Failed to send OTP")

@app.post("/api/auth/verify-otp")
def verify_otp(req: VerifyOtpReq):
    supabase = get_supabase()
    otp_res = supabase.table("otp_requests").select("*").eq("email", req.email).eq("otp_code", req.otp).execute()
    if otp_res.data:
        hashed_pw = hash_password(req.password)
        supabase.table("custom_users").insert({"email": req.email, "password_hash": hashed_pw}).execute()
        supabase.table("otp_requests").delete().eq("email", req.email).execute()
        return {"status": "success", "message": "Account created!"}
    raise HTTPException(status_code=400, detail="Invalid OTP code")

# --- WORKSPACE & INGESTION ENDPOINTS ---
@app.get("/api/inventory/{user_email}")
def fetch_inventory(user_email: str):
    return get_inventory(user_email)

@app.delete("/api/workspace")
def remove_workspace(subject: str, user_email: str):
    delete_workspace(subject, user_email)
    return {"status": "workspace deleted"}

@app.post("/api/upload")
async def upload_file(
    file: UploadFile = File(...),
    subject: str = Form(...),
    user_email: str = Form(...)
):
    try:
        contents = await file.read()
        
        # 1. Extract text chunks based on file type
        if file.filename.endswith('.pdf'):
            chunks = process_pdf(contents)
        else:
            chunks = process_raw_text(contents)
            
        # 2. Upload the actual file to Supabase Storage
        upload_to_supabase_storage(user_email, subject, file.filename, contents)
        
        # 3. Generate embeddings and save them to the Supabase database
        supabase = get_supabase()
        for chunk in chunks:
            embedding = get_embedding(chunk)
            supabase.table("veda_documents").insert({
                "user_email": user_email,
                "subject": subject,
                "source": file.filename,
                "content": chunk,
                "embedding": embedding
            }).execute()
            
        return {"message": f"Successfully uploaded {file.filename}"}
        
    except Exception as e:
        print(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/file")
def remove_file(filename: str, subject: str, user_email: str):
    delete_file(filename, subject, user_email)
    return {"status": "file deleted"}

# --- CHAT & TEACHER TOOLS ENDPOINTS ---
@app.get("/api/chat/history")
def get_chat_history(user_email: str, subject: str):
    return load_chat_history(user_email, subject)

@app.put("/api/chat/history")
def update_chat_history(req: UpdateHistoryReq):
    supabase = get_supabase()
    try:
        supabase.table("chat_history").delete().eq("email", req.user_email).eq("subject", req.subject).execute()
        
        if req.messages:
            new_rows = [
                {
                    "email": req.user_email, 
                    "subject": req.subject, 
                    "role": msg["role"], 
                    "content": msg["content"]
                } 
                for msg in req.messages
            ]
            supabase.table("chat_history").insert(new_rows).execute()
            
        return {"status": "success"}
    except Exception as e:
        print(f"Edit error: {e}")
        raise HTTPException(status_code=500, detail="Failed to save edited message")

@app.post("/api/chat/stream")
def chat_stream(req: ChatReq):
    chat_history = load_chat_history(req.user_email, req.subject)
    save_chat_message(req.user_email, req.subject, "user", req.question)

    def event_generator():
        full_response = ""
        for chunk in ask_veda_stream(req.user_email, req.question, req.subject, chat_history):
            full_response += chunk
            yield chunk
        save_chat_message(req.user_email, req.subject, "assistant", full_response)

    return StreamingResponse(event_generator(), media_type="text/plain")

@app.post("/api/tools/generate")
def generate_tool(req: ToolReq):
    subject_text = get_subject_text(req.subject, req.user_email)
    if not subject_text:
        raise HTTPException(status_code=400, detail="No content available for this workspace.")

    if req.tool_type == "quiz":
        prompt = f"""You are Veda, a human teacher. Start an interactive quiz based on the notes below. 
        CRITICAL INSTRUCTIONS:
        1. Generate EXACTLY ONE multiple-choice question.
        2. Provide the question and options A, B, C, and D.
        3. DO NOT output more than one question.
        4. DO NOT provide the answer key or tell the student the correct answer yet. 
        
        Notes:
        {subject_text[:30000]}"""
    else:
        prompt = f"You are Veda. Provide a concise, structured study guide with Main Themes, Core Concepts, and Critical Takeaways based on these notes:\n\n{subject_text[:30000]}"

    def event_generator():
        full_response = ""
        for chunk in generate_with_failover_stream(prompt):
            full_response += chunk
            yield chunk
        save_chat_message(req.user_email, req.subject, "assistant", full_response)

    return StreamingResponse(event_generator(), media_type="text/plain")