"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { X, Plus, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { registerCandidate, getAvailableSkills } from "@/app/api"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Updated to match the check constraint in the database
const QUALIFICATION_OPTIONS = [
  "10",
  "12",
  "ITI",
  "Diploma",
  "UG", // Undergraduate
  "PG"  // Postgraduate
]

const CATEGORY_CODES = [
  "GEN", // General
  "OBC", // Other Backward Classes
  "SC",  // Scheduled Castes
  "ST",  // Scheduled Tribes
]

const DISABILITY_CODES = [
  "NONE",
  "VI",   // Visual Impairment
  "HI",   // Hearing Impairment
  "OTHER"
]

export default function CandidateOnboardingPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [availableSkills, setAvailableSkills] = useState([])
  const [isLoadingSkills, setIsLoadingSkills] = useState(false)
  
  const [formData, setFormData] = useState({
    // Step 1: Personal Info
    name: "",
    email: localStorage.getItem("userEmail") || "", // Pre-filled from registration
    password: localStorage.getItem("userPassword") || "", // Pre-filled from registration
    phone: "",
    highest_qualification: "",
    ext_id: "",
    
    // Step 2: Educational details
    degree: "",
    cgpa: "",
    grad_year: new Date().getFullYear(),
    tenth_percent: "",
    twelfth_percent: "",
    
    // Step 3: Additional info
    location_pref: "",
    pincode: "",
    willing_radius_km: "20",
    category_code: "GEN",
    disability_code: "NONE",
    languages: [],
    selectedSkills: [], // Changed to store skill_code values
    resume_url: "",
    resume_summary: "",
  })

  const [languageInput, setLanguageInput] = useState("")
    
  // Fetch available skills when the component mounts
  useEffect(() => {
    const fetchSkills = async () => {
      try {
        setIsLoadingSkills(true)
        const skills = await getAvailableSkills()
        setAvailableSkills(skills)
      } catch (error) {
        console.error("Failed to fetch skills:", error)
        setError("Failed to load skills. Please try refreshing the page.")
      } finally {
        setIsLoadingSkills(false)
      }
    }
    
    fetchSkills()
  }, [])

  const progress = (currentStep / 3) * 100
  
  // Toggle skill selection
  const toggleSkill = (skillCode) => {
    setFormData(prev => {
      if (prev.selectedSkills.includes(skillCode)) {
        return {
          ...prev,
          selectedSkills: prev.selectedSkills.filter(code => code !== skillCode)
        }
      } else {
        return {
          ...prev,
          selectedSkills: [...prev.selectedSkills, skillCode]
        }
      }
    })
  }
  
  // Languages management
  const addLanguage = () => {
    if (languageInput && !formData.languages.includes(languageInput)) {
      setFormData({ ...formData, languages: [...formData.languages, languageInput] })
      setLanguageInput("")
    }
  }

  const removeLanguage = (language) => {
    setFormData({
      ...formData,
      languages: formData.languages.filter((l) => l !== language),
    })
  }
  
  useEffect(() => {
  // Check if this is a direct access (no credentials in localStorage)
  const directAccess = !localStorage.getItem("userEmail") && !localStorage.getItem("userPassword");
  
  // If direct access, make sure we're at step 1 
  if (directAccess && currentStep !== 1) {
    setCurrentStep(1);
  }
}, []);




  const handleSubmit = async () => {
    try {
      setIsSubmitting(true)
      setError("")

      // Format data for API
      const studentData = {
        ...formData,
        // Convert selected skill codes to comma-separated string of skill names
        skills_text: availableSkills
          .filter(skill => formData.selectedSkills.includes(skill.skill_code))
          .map(skill => skill.name)
          .join(", "),
        // Convert languages array to JSON string
        languages_json: JSON.stringify(formData.languages),
      }
      
      // Remove the arrays which are converted
      delete studentData.languages
      delete studentData.selectedSkills
      
      // Submit to API
      const response = await registerCandidate(studentData)
      
      // Store student info in local storage
      localStorage.setItem("user", JSON.stringify(response))
      
      // Clean up registration data
      localStorage.removeItem("userEmail")
      localStorage.removeItem("userPassword")
      
      // Redirect to dashboard
      router.push("/candidate/dashboard")
    } catch (err) {
      console.error("Onboarding error:", err)
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleNext = () => {
    // Validate required fields for each step
    if (currentStep === 1) {
      if (!formData.name) {
        setError("Name is required")
        return
      }
      if (!formData.email) {
        setError("Email is required")
        return
      }
      if (!formData.password) {
        setError("Password is required")
        return
      }
      if (!formData.phone) {
        setError("Phone number is required")
        return
      }
    }
    
    setError("")
    
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1)
    } else {
      handleSubmit()
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
    setError("")
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span className={currentStep >= 1 ? "text-primary font-medium" : ""}>1. Personal Info</span>
            <span className={currentStep >= 2 ? "text-primary font-medium" : ""}>2. Educational Details</span>
            <span className={currentStep >= 3 ? "text-primary font-medium" : ""}>3. Additional Information</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <Card className="border-border shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl">
              {currentStep === 1 && "Personal Information"}
              {currentStep === 2 && "Educational Background"}
              {currentStep === 3 && "Additional Details"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {/* Step 1: Personal Info */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter your full name"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
                  <Input 
                    id="email" 
                    type="email"
                    value={formData.email} 
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="your.email@example.com"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Password <span className="text-destructive">*</span></Label>
                  <Input 
                    id="password" 
                    type="password"
                    value={formData.password} 
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Enter your password"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">Password must be at least 6 characters</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number <span className="text-destructive">*</span></Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Enter your phone number"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="highest_qualification">Highest Qualification</Label>
                  <Select 
                    value={formData.highest_qualification} 
                    onValueChange={(value) => setFormData({ ...formData, highest_qualification: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select your highest qualification" />
                    </SelectTrigger>
                    <SelectContent>
                      {QUALIFICATION_OPTIONS.map((qual) => (
                        <SelectItem key={qual} value={qual}>
                          {qual === "UG" ? "Undergraduate" : 
                           qual === "PG" ? "Postgraduate" : qual}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Select the highest level of education you've completed</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="ext_id">Student/Employee ID (Optional)</Label>
                  <Input
                    id="ext_id"
                    value={formData.ext_id}
                    onChange={(e) => setFormData({ ...formData, ext_id: e.target.value })}
                    placeholder="If applicable, enter your ID"
                  />
                  <p className="text-xs text-muted-foreground mt-1">College roll number or any other identification number</p>
                </div>
              </div>
            )}

            {/* Step 2: Educational Details */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="degree">Degree/Program</Label>
                  <Input
                    id="degree"
                    value={formData.degree}
                    onChange={(e) => setFormData({ ...formData, degree: e.target.value })}
                    placeholder="e.g., B.Tech Computer Science"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Leave empty if not applicable</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="cgpa">CGPA/Percentage</Label>
                  <Input
                    id="cgpa"
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    value={formData.cgpa}
                    onChange={(e) => setFormData({ ...formData, cgpa: e.target.value })}
                    placeholder="e.g., 8.5"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Current CGPA or overall percentage in your degree program</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="grad_year">Graduation Year</Label>
                  <Input
                    id="grad_year"
                    type="number"
                    value={formData.grad_year}
                    onChange={(e) => setFormData({ ...formData, grad_year: e.target.value })}
                    placeholder="e.g., 2025"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Year when you completed/will complete your highest qualification</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="tenth_percent">10th Percentage</Label>
                  <Input
                    id="tenth_percent"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.tenth_percent}
                    onChange={(e) => setFormData({ ...formData, tenth_percent: e.target.value })}
                    placeholder="e.g., 85.5"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Leave empty if not applicable</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="twelfth_percent">12th Percentage</Label>
                  <Input
                    id="twelfth_percent"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.twelfth_percent}
                    onChange={(e) => setFormData({ ...formData, twelfth_percent: e.target.value })}
                    placeholder="e.g., 88.7"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Leave empty if not applicable</p>
                </div>
              </div>
            )}

            {/* Step 3: Additional Details */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="category_code">Category <span className="text-destructive">*</span></Label>
                  <Select 
                    value={formData.category_code} 
                    onValueChange={(value) => setFormData({ ...formData, category_code: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select your category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_CODES.map((code) => (
                        <SelectItem key={code} value={code}>{code}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="disability_code">Disability Status <span className="text-destructive">*</span></Label>
                  <Select 
                    value={formData.disability_code} 
                    onValueChange={(value) => setFormData({ ...formData, disability_code: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select disability status" />
                    </SelectTrigger>
                    <SelectContent>
                      {DISABILITY_CODES.map((code) => (
                        <SelectItem key={code} value={code}>{code}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="location_pref">Preferred Location</Label>
                  <Input
                    id="location_pref"
                    value={formData.location_pref}
                    onChange={(e) => setFormData({ ...formData, location_pref: e.target.value })}
                    placeholder="e.g., Mumbai, Delhi, Remote"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pincode">Pincode</Label>
                    <Input
                      id="pincode"
                      maxLength={6}
                      value={formData.pincode}
                      onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                      placeholder="e.g., 400001"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="willing_radius_km">Willing Travel Radius (km)</Label>
                    <Input
                      id="willing_radius_km"
                      type="number"
                      min="0"
                      value={formData.willing_radius_km}
                      onChange={(e) => setFormData({ ...formData, willing_radius_km: e.target.value })}
                      placeholder="e.g., 20"
                    />
                  </div>
                </div>
                
                {/* Selectable Skills */}
                <div className="space-y-2">
                  <Label>Skills</Label>
                  {isLoadingSkills ? (
                    <p className="text-sm text-muted-foreground">Loading skills...</p>
                  ) : (
                    <div className="flex flex-wrap gap-2 mt-2">
                      <TooltipProvider>
                        {availableSkills.map((skill) => (
                          <Tooltip key={skill.skill_code}>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant={formData.selectedSkills.includes(skill.skill_code) ? "default" : "outline"}
                                onClick={() => toggleSkill(skill.skill_code)}
                                className="rounded-full"
                                size="sm"
                              >
                                {skill.name}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>NSQF Level: {skill.nsqf_level}</p>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </TooltipProvider>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Click to select/deselect relevant skills
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label>Languages</Label>
                  <div className="flex gap-2">
                    <Input
                      value={languageInput}
                      onChange={(e) => setLanguageInput(e.target.value)}
                      placeholder="Add a language..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          addLanguage()
                        }
                      }}
                    />
                    <Button type="button" onClick={addLanguage} size="icon">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {formData.languages.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.languages.map((language) => (
                        <Badge key={language} variant="secondary" className="flex items-center gap-1">
                          {language}
                          <button
                            type="button"
                            onClick={() => removeLanguage(language)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="resume_url">Resume URL (Optional)</Label>
                  <Input
                    id="resume_url"
                    value={formData.resume_url}
                    onChange={(e) => setFormData({ ...formData, resume_url: e.target.value })}
                    placeholder="Link to your resume or portfolio"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="resume_summary">Brief Summary</Label>
                  <Textarea
                    id="resume_summary"
                    value={formData.resume_summary}
                    onChange={(e) => setFormData({ ...formData, resume_summary: e.target.value })}
                    placeholder="Write a short summary about yourself, your career goals, and what you're looking for in an internship..."
                    rows={4}
                  />
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleBack} 
                disabled={currentStep === 1 || isSubmitting}
              >
                Back
              </Button>
              <Button 
                onClick={handleNext} 
                disabled={isSubmitting}
              >
                {isSubmitting 
                  ? "Please wait..." 
                  : currentStep === 3 
                    ? "Submit Profile" 
                    : "Next"
                }
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}