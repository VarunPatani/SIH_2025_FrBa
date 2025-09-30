const API =  "http://127.0.0.1:8000";

export async function health() {
    const r = await fetch(`${API}/health`);
    if (!r.ok) throw new Error("API down");
    return r.json();
}


export async function checkCandidateLogin(email,password) {
    const r = await fetch(`${API}/auth/candidates/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({email,password}),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
}


export async function registerCandidate(studentData) {
    const r = await fetch(`${API}/auth/candidates/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(studentData),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
}

// Add this function to your existing api.js file
export async function getAvailableSkills() {
  const r = await fetch(`${API}/auth/skills`);
  if (!r.ok) throw new Error("Failed to fetch skills");
  return r.json();
}

// ...existing code...

// Get top matches for a student
export async function getTopMatchesForStudent(studentId) {
  try {
    const response = await fetch(`${API}/dashboard/matches/student/${studentId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch matches: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("API error in getTopMatchesForStudent:", error);
    throw error;
  }
}

// Get student preferences
export async function getStudentPreferences(studentId) {
  try {
    const response = await fetch(`${API}/dashboard/preferences/student/${studentId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch preferences: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("API error in getStudentPreferences:", error);
    throw error;
  }
}

// Get student profile completion status
export async function getProfileCompletion(studentId) {
  try {
    const response = await fetch(`${API}/dashboard/students/${studentId}/completion`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch profile completion: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("API error in getProfileCompletion:", error);
    throw error;
  }
}

export async function getMatchedInternships(studentId, filters = {}) {
  // Build query string from filters
  const queryParams = new URLSearchParams();
  
  if (filters.location) queryParams.append('location', filters.location);
  if (filters.company) queryParams.append('company', filters.company);
  if (filters.skill) queryParams.append('skill', filters.skill);
  if (filters.search) queryParams.append('search', filters.search);
  
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
  
  const r = await fetch(`${API}/search/matches/${studentId}${queryString}`);
  if (!r.ok) throw new Error("Failed to fetch matched internships");
  return r.json();
}
// Get non-matched internships for a student
export async function getNonMatchedInternships(studentId, filters = {}) {
  // Build query string from filters
  const queryParams = new URLSearchParams();
  
  if (filters.location) queryParams.append('location', filters.location);
  if (filters.company) queryParams.append('company', filters.company);
  if (filters.skill) queryParams.append('skill', filters.skill);
  if (filters.search) queryParams.append('search', filters.search);
  
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
  
  const r = await fetch(`${API}/search/non-matches/${studentId}${queryString}`);
  if (!r.ok) throw new Error("Failed to fetch non-matched internships");
  return r.json();
}

// Get filter options
export async function getSearchFilterOptions() {
  const r = await fetch(`${API}/search/filters`);
  if (!r.ok) throw new Error("Failed to fetch filter options");
  return r.json();
}

// Get details of a specific internship
export async function getInternshipDetails(internshipId) {
  const r = await fetch(`${API}/internships_details/${internshipId}`);
  if (!r.ok) throw new Error("Failed to fetch internship details");
  return r.json();
}

// Add an internship to student preferences
export async function addInternshipPreference(studentId, internshipId) {
  const r = await fetch(`${API}/preferences`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      student_id: studentId,
      internship_id: internshipId
    }),
  });
  if (!r.ok) throw new Error("Failed to add preference");
  return r.json();
}

// Get user profile data
export async function getUserProfile(studentId) {
  const r = await fetch(`${API}/students/${studentId}`);
  if (!r.ok) throw new Error("Failed to fetch user profile");
  return r.json();
}

// Update user profile
export async function updateUserProfile(profileData) {
  const r = await fetch(`${API}/students/update`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profileData),
  });
  if (!r.ok) throw new Error("Failed to update profile");
  return r.json();
}

export async function checkCompanyLogin(email, password) {
    const r = await fetch(`${API}/auth/companies/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({email, password}),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
}

export async function registerCompany(companyData) {
    const r = await fetch(`${API}/auth/companies/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(companyData),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
}

// ...existing code...

// Get company information
export async function getCompanyInfo(companyId) {
  const r = await fetch(`${API}/companies/${companyId}`);
  if (!r.ok) throw new Error("Failed to fetch company information");
  return r.json();
}

// Get company internships
export async function getCompanyInternships(companyId) {
  const r = await fetch(`${API}/companies/${companyId}/internships`);
  if (!r.ok) throw new Error("Failed to fetch company internships");
  return r.json();
}

// Get company dashboard stats
export async function getCompanyDashboardStats(companyId) {
  const r = await fetch(`${API}/companies/${companyId}/dashboard-stats`);
  if (!r.ok) throw new Error("Failed to fetch dashboard stats");
  return r.json();
}


export async function createInternship(internshipData) {
  const r = await fetch(`${API}/internships/create_internship`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(internshipData),
  });
  if (!r.ok) {
    const errorText = await r.text();
    throw new Error(errorText || "Failed to create internship");
  }
  return r.json();
}
// Update internship status
export async function updateInternshipStatus(internshipId, status) {
  const r = await fetch(`${API}/internships/${internshipId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!r.ok) throw new Error("Failed to update internship status");
  return r.json();
}


export async function getInternshipCandidates(internshipId) {
  const r = await fetch(`${API}/internships/${internshipId}/candidates`);
  if (!r.ok) throw new Error("Failed to fetch candidates for internship");
  return r.json();
}


export async function getInternshipById(internshipId) {
  const r = await fetch(`${API}/internships/${internshipId}`);
  if (!r.ok) throw new Error("Failed to fetch internship details");
  return r.json();
}


export async function getCandidateDetails(candidateId) {
  const r = await fetch(`${API}/students/${candidateId}`);
  if (!r.ok) throw new Error("Failed to fetch candidate details");
  return r.json();
}


export async function shortlistCandidate(internshipId, candidateId) {
  const r = await fetch(`${API}/internships/${internshipId}/shortlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ student_id: candidateId }),
  });
  if (!r.ok) throw new Error("Failed to shortlist candidate");
  return r.json();
}


export async function toggleInternshipStatus(internshipId, isActive) {
  const r = await fetch(`${API}/internships/${internshipId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_active: isActive }),
  });
  if (!r.ok) throw new Error("Failed to update internship status");
  return r.json();
}

// Update the runAllocation function
// Add these modifications to your runAllocation function
export async function runAllocation(config = {}) {
  try {
    const r = await fetch(`${API}/allocation/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config)
    });
    
    const data = await r.json();
    
    // Check for special messages
    if (data.message && !r.ok) {
      // This isn't a real error but a controlled response
      return data;
    }
    
    if (!r.ok) {
      throw new Error(data.detail || "Failed to run allocation");
    }
    
    return data;
  } catch (error) {
    console.error("Allocation error:", error);
    throw error;
  }
}

// Similarly for the other allocation functions

// Get the latest allocation run
export async function latestRun() {
  const r = await fetch(`${API}/allocation/runs/latest`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// Get results of a specific run
export async function runResults(runId) {
  const r = await fetch(`${API}/allocation/runs/${runId}/results`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// Download results as CSV
export function downloadRunResults(runId) {
  if (!runId) return;
  window.open(`${API}/download/${runId}.csv`, "_blank");
}

// Get stats for unmatched students and internships
export async function getUnmatchedStats() {
  const r = await fetch(`${API}/allocation/unmatched`);
  if (!r.ok) throw new Error("Failed to fetch unmatched stats");
  return r.json();
}

export async function getAllocationRuns(limit = 20, offset = 0) {
  const r = await fetch(`${API}/allocation/runs?limit=${limit}&offset=${offset}`);
  if (!r.ok) throw new Error("Failed to fetch allocation runs");
  return r.json();
}

// Add these new functions after your existing runAllocation function

// Run NLP-based allocation
export async function runNlpAllocation(config = {}) {
  try {
    const r = await fetch(`${API}/allocation/nlp/run`, { 
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config)
    });
    
    if (!r.ok) {
      const errorText = await r.text();
      console.error("NLP Allocation API error:", errorText);
      throw new Error(errorText || "Failed to run NLP allocation");
    }
    
    return r.json();
  } catch (error) {
    console.error("NLP Allocation error:", error);
    throw error;
  }
}

// Run Ensemble allocation
export async function runEnsembleAllocation(config = {}) {
  try {
    const r = await fetch(`${API}/allocation/ensemble/run`, { 
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config)
    });
    
    if (!r.ok) {
      const errorText = await r.text();
      console.error("Ensemble Allocation API error:", errorText);
      throw new Error(errorText || "Failed to run ensemble allocation");
    }
    
    return r.json();
  } catch (error) {
    console.error("Ensemble Allocation error:", error);
    throw error;
  }
}



// ...existing code...
// export async function uploadStudentsCsv(file, { autoAllocate = true, mode = "upsert" } = {}) {
//     const fd = new FormData();
//     fd.append("file", file);
//     const r = await fetch(`${API}/upload/students?auto_allocate=${autoAllocate}&mode=${mode}`, {
//         method: "POST",
//         body: fd,
//     });
//     if (!r.ok) throw new Error(await r.text());
//     return r.json();
// }

// export async function runAllocation() {
//     const r = await fetch(`${API}/run`, { method: "POST" });
//     if (!r.ok) throw new Error(await r.text());
//     return r.json();
// }

// export async function latestRun() {
//     const r = await fetch(`${API}/runs/latest`);
//     if (!r.ok) throw new Error(await r.text());
//     return r.json();
// }

// export async function runResults(runId) {
//     const r = await fetch(`${API}/runs/${runId}/results`);
//     if (!r.ok) throw new Error(await r.text());
//     return r.json();
// }

// export function downloadCsv(runId) {
//     if (!runId) return;
//     window.open(`${API}/download/${runId}.csv`, "_blank");
// }

// export async function createInternship(payload) {
//     const r = await fetch(`${API}/internships`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(payload),
//     });
//     if (!r.ok) throw new Error(await r.text());
//     return r.json();
// }

// export async function listInternships() {
//     const r = await fetch(`${API}/internships`);
//     if (!r.ok) throw new Error(await r.text());
//     return r.json();
// }