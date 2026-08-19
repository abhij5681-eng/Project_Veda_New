import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for preferences sync
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Your working Render Backend API Base
const API_BASE = "https://project-veda-new.onrender.com/api";

export async function loginUser(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("Login failed");
  return res.json();
}

export async function getInventory(userEmail) {
  const res = await fetch(`${API_BASE}/inventory/${userEmail}`, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
  return res.json();
}

export async function uploadFile(userEmail, subject, file) {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error("Currently, Veda only supports PDF files. Please upload a PDF document!");
  }

  const formData = new FormData();
  formData.append("user_email", userEmail);
  formData.append("subject", subject);
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    let errorMessage = "Failed to upload file";
    try {
      const errorData = await res.json();
      errorMessage = errorData.detail || errorData.message || errorMessage;
    } catch (e) {
      // Fallback
    }
    throw new Error(errorMessage);
  }

  return res.json();
}

export async function getChatHistory(userEmail, subject) {
  const res = await fetch(`${API_BASE}/chat/history?user_email=${userEmail}&subject=${subject}`);
  return res.json();
}

// 👇 UPDATED: Added language parameter and payload
export async function streamVedaChat(userEmail, subject, question, onChunk, language="English") {
  const response = await fetch(`${API_BASE}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_email: userEmail, subject, question, language }),
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    onChunk(chunk);
  }
}

// 👇 UPDATED: Added language parameter and payload
export async function generateToolStream(userEmail, subject, toolType, onChunk, language="English") {
  const response = await fetch(`${API_BASE}/tools/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_email: userEmail, subject, tool_type: toolType, language }),
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    fullText += chunk;
    onChunk(fullText);
  }
  return fullText;
}

export async function requestOtp(email, password) {
  const res = await fetch(`${API_BASE}/auth/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.detail || "Failed to send OTP");
  }
  return res.json();
}

export async function verifyOtp(email, otp, password) {
  const res = await fetch(`${API_BASE}/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp, password }),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.detail || "Failed to verify OTP");
  }
  return res.json();
}

export async function deleteFile(userEmail, subject, filename) {
  const res = await fetch(`${API_BASE}/file?filename=${encodeURIComponent(filename)}&subject=${encodeURIComponent(subject)}&user_email=${encodeURIComponent(userEmail)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete file");
  return res.json();
}

export async function deleteWorkspace(userEmail, subject) {
  const res = await fetch(`${API_BASE}/workspace?subject=${encodeURIComponent(subject)}&user_email=${encodeURIComponent(userEmail)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete workspace");
  return res.json();
}

export async function replaceChatHistory(userEmail, subject, messages) {
  const res = await fetch(`${API_BASE}/chat/history`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_email: userEmail, subject, messages }),
  });
  if (!res.ok) throw new Error("Failed to update history");
  return res.json();
}

export async function getUserPreferences(email) {
  if (!email) return null;
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('email', email);
    
    if (error) {
      console.error("Error fetching preferences:", error);
      return null;
    }
    
    return data && data.length > 0 ? data[0] : null;
  } catch (err) {
    console.error("Failed to load preferences", err);
    return null;
  }
}

// Replace your existing updateUserPreferences with this:
export async function updateUserPreferences(email, preferences) {
  if (!email) return;
  try {
    const { error } = await supabase
      .from('user_preferences')
      .upsert({ email, ...preferences, updated_at: new Date() });
    
    if (error) {
      console.error("Supabase Error:", error);
      throw error;
    }
  } catch (err) {
    console.error("Failed to save preferences", err);
    throw err;
  }
}

// 👇 UPDATED: Changed localhost:8000 to API_BASE and added language
export const generateQuizQuestion = async (userEmail, activeSubject, language="English") => {
  const response = await fetch(`${API_BASE}/quiz/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userEmail, workspace_id: activeSubject, language })
  });
  if (!response.ok) throw new Error("Failed to generate quiz");
  return await response.json();
};

export const fetchProactiveQuestion = async (userEmail, activeSubject, language = "English") => {
  const response = await fetch(`${API_BASE}/quiz/proactive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_email: userEmail, workspace_id: activeSubject, language })
  });
  if (!response.ok) throw new Error("Failed to fetch background question");
  return await response.json();
};

export const updateConceptMastery = async (conceptId, isCorrect) => {
  try {
    await fetch(`${API_BASE}/quiz/update-mastery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ concept_id: conceptId, is_correct: isCorrect })
    });
  } catch (error) {
    console.error("Failed to update Veda's memory:", error);
  }
};