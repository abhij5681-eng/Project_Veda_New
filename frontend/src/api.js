
// To this:
const API_BASE = "https://project-veda-new.onrender.com";

export async function loginUser(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("Login failed");
  return res.json();
}
// ... (the rest of your functions using API_BASE will now work perfectly)

export async function getInventory(userEmail) {
  const res = await fetch(`${API_BASE}/inventory/${userEmail}`);
  return res.json();
}

export async function uploadFile(userEmail, subject, file) {
  const formData = new FormData();
  formData.append("user_email", userEmail);
  formData.append("subject", subject);
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    body: formData,
  });
  return res.json();
}

export async function getChatHistory(userEmail, subject) {
  const res = await fetch(`${API_BASE}/chat/history?user_email=${userEmail}&subject=${subject}`);
  return res.json();
}

export async function streamVedaChat(userEmail, subject, question, onChunk) {
  const response = await fetch(`${API_BASE}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_email: userEmail, subject, question }),
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

// Add or replace this function in api.js
export async function generateToolStream(userEmail, subject, toolType, onChunk) {
  const response = await fetch(`${API_BASE}/tools/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_email: userEmail, subject, tool_type: toolType }),
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