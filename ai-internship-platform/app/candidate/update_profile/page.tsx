"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { PortalNav } from "@/components/navigation/portal-nav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { 
  AlertCircle, 
  User, 
  Phone, 
  Mail, 
  BookOpen, 
  MapPin, 
  Languages, 
  Code, 
  Save, 
  X,
  Loader2
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "@/components/ui/use-toast"
import { getUserProfile, getAvailableSkills, updateUserProfile, getProfileCompletion } from "@/app/api"

// Add this interface at the top of your file
interface Skill {
  skill_code: string;
  name: string;
  nsqf_level?: number;
}


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

export default function CandidateProfilePage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([])
  const [isLoadingSkills, setIsLoadingSkills] = useState(false)
  const [profileCompletion, setProfileCompletion] = useState(0)
  const [missingFields, setMissingFields] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    highest_qualification: "",
    ext_id: "",
    degree: "",
    cgpa: "",
    grad_year: new Date().getFullYear(),
    tenth_percent: "",
    twelfth_percent: "",
    location_pref: "",
    pincode: "",
    willing_radius_km: parseInt(""),
    category_code: "GEN",
    disability_code: "NONE",
    languages: [],
    selectedSkills: [] as string[],
    resume_url: "",
    resume_summary: ""
  })

  const [languageInput, setLanguageInput] = useState("")
  
  // Define navigation items
  const navItems = [
    { label: "Dashboard", href: "/candidate/dashboard" },
    { label: "Search", href: "/candidate/search" },
    { label: "Profile", href: "/candidate/profile", active: true },
  ]
  
  // Fetch user profile data and available skills when the component mounts
  useEffect(() => {
    // Check if user is logged in
    const userData = localStorage.getItem("user")
    
    if (!userData) {
      router.push("/candidate/login")
      return
    }

    const parsedUser = JSON.parse(userData)
    setUser(parsedUser)
    
    async function loadProfileData() {
      try {
        setLoading(true)
        
        // Fetch user profile data
        const profileData = await getUserProfile(parsedUser.student_id)
        
        // Fetch completion data to highlight missing fields
        const completionData = await getProfileCompletion(parsedUser.student_id)
        setProfileCompletion(completionData.completion_percentage)
        setMissingFields(completionData.missing_fields)
        
        // Fetch available skills
        setIsLoadingSkills(true)
        const skills = await getAvailableSkills()
        setAvailableSkills(skills)
        
        // Parse languages from JSON if it exists
        let languages = []
        try {
          if (profileData.languages_json) {
            languages = JSON.parse(profileData.languages_json)
          }
        } catch (e) {
          console.error("Error parsing languages:", e)
        }
        
        // Parse skills from text if it exists
        let selectedSkills = []
        if (profileData.skills_text) {
          selectedSkills = profileData.skills_text.split(',').map(skill => skill.trim())
        }
        
        // Update form data with profile information
        setFormData({
          name: profileData.name || "",
          email: profileData.email || "",
          phone: profileData.phone || "",
          highest_qualification: profileData.highest_qualification || "",
          ext_id: profileData.ext_id || "",
          degree: profileData.degree || "",
          cgpa: profileData.cgpa || "",
          grad_year: profileData.grad_year || new Date().getFullYear(),
          tenth_percent: profileData.tenth_percent || "",
          twelfth_percent: profileData.twelfth_percent || "",
          location_pref: profileData.location_pref || "",
          pincode: profileData.pincode || "",
          willing_radius_km: profileData.willing_radius_km || 20,
          category_code: profileData.category_code || "GEN",
          disability_code: profileData.disability_code || "NONE",
          languages: languages || [],
          selectedSkills: selectedSkills || [],
          resume_url: profileData.resume_url || "",
          resume_summary: profileData.resume_summary || ""
        })
      } catch (err) {
        console.error("Error loading profile data:", err)
        setError("Failed to load profile data. Please refresh or try again later.")
      } finally {
        setLoading(false)
        setIsLoadingSkills(false)
      }
    }
    
    loadProfileData()
  }, [router])
  
  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }
  
  // Toggle skill selection
    const toggleSkill = (skill: Skill) => {
    setFormData(prev => {
        const currentSkills = [...prev.selectedSkills];
        
        if (currentSkills.includes(skill.skill_code)) {
        return {
            ...prev,
            selectedSkills: currentSkills.filter(s => s !== skill.skill_code)
        };
        } else {
        return {
            ...prev,
            selectedSkills: [...currentSkills, skill.skill_code]
        };
        }
    });
    };
  
  // Languages management
  const addLanguage = () => {
    if (languageInput && !formData.languages.includes(languageInput)) {
      setFormData(prev => ({
        ...prev,
        languages: [...prev.languages, languageInput]
      }))
      setLanguageInput("")
    }
  }

  const removeLanguage = (language) => {
    setFormData(prev => ({
      ...prev,
      languages: prev.languages.filter(lang => lang !== language)
    }))
  }
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!user) {
      setError("User information not found. Please log in again.")
      return
    }
    
    try {
      setIsSubmitting(true)
      
      // Convert selectedSkills array to comma-separated string
      const skills_text = formData.selectedSkills.join(', ')
      
      // Convert languages array to JSON string
      const languages_json = JSON.stringify(formData.languages)
      
      const profileData = {
        ...formData,
        student_id: user.student_id,
        skills_text,
        languages_json
      }
      
      await updateUserProfile(profileData)
      
      // Show success message
      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated.",
        duration: 5000
      })
      
      // Refresh profile completion data
      const completionData = await getProfileCompletion(user.student_id)
      setProfileCompletion(completionData.completion_percentage)
      setMissingFields(completionData.missing_fields)
      
      // If profile is now 100% complete, show message and redirect
      if (completionData.completion_percentage === 100) {
        toast({
          title: "Profile Complete!",
          description: "Your profile is now 100% complete. You'll get better internship matches.",
          duration: 5000
        })
        
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          router.push("/candidate/dashboard")
        }, 2000)
      }
    } catch (err) {
      console.error("Error updating profile:", err)
      setError("Failed to update profile. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }
  
  // Render loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading your profile...</p>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-background">
      <PortalNav 
        portalName="Candidate Portal" 
        userName={user?.name || "User"} 
        currentPage="Profile" 
        navItems={navItems} 
      />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header section */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Your Profile</h1>
            <p className="text-muted-foreground mt-1">
              Complete your profile to get better internship matches
            </p>
          </div>
          <Card className="p-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Profile Completion</span>
                <span className="font-medium">{profileCompletion}%</span>
              </div>
              <Progress value={profileCompletion} className="h-2" />
            </div>
          </Card>
        </div>
        
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleSubmit}>
          {/* Personal Information Section */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Personal Information
              </CardTitle>
              <CardDescription>
                Your basic information and contact details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Name Field */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="name">Full Name</Label>
                  {missingFields.includes('Name') && (
                    <Badge variant="outline" className="text-destructive border-destructive">
                      Required
                    </Badge>
                  )}
                </div>
                <Input
                  id="name"
                  name="name"
                  placeholder="Your full name"
                  value={formData.name}
                  onChange={handleChange}
                  className={missingFields.includes('Name') ? "border-destructive" : ""}
                />
              </div>
              
              {/* Email Field */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="email">Email</Label>
                  {missingFields.includes('Email') && (
                    <Badge variant="outline" className="text-destructive border-destructive">
                      Required
                    </Badge>
                  )}
                </div>
                <div className="flex items-center">
                  <Mail className="mr-2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    className={missingFields.includes('Email') ? "border-destructive" : ""}
                  />
                </div>
              </div>
              
              {/* Phone Field */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="phone">Phone Number</Label>
                  {missingFields.includes('Phone Number') && (
                    <Badge variant="outline" className="text-destructive border-destructive">
                      Required
                    </Badge>
                  )}
                </div>
                <div className="flex items-center">
                  <Phone className="mr-2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    name="phone"
                    placeholder="Your phone number"
                    value={formData.phone}
                    onChange={handleChange}
                    className={missingFields.includes('Phone Number') ? "border-destructive" : ""}
                  />
                </div>
              </div>
              
              {/* Category Code Field */}
              <div className="space-y-2">
                <Label htmlFor="category_code">Category</Label>
                <Select
                  name="category_code"
                  value={formData.category_code}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category_code: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_CODES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Disability Code Field */}
              <div className="space-y-2">
                <Label htmlFor="disability_code">Disability Status</Label>
                <Select
                  name="disability_code"
                  value={formData.disability_code}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, disability_code: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select disability status" />
                  </SelectTrigger>
                  <SelectContent>
                    {DISABILITY_CODES.map((code) => (
                      <SelectItem key={code} value={code}>
                        {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
          
          {/* Education Section */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Education
              </CardTitle>
              <CardDescription>
                Your educational qualifications and achievements
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Highest Qualification Field */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="highest_qualification">Highest Qualification</Label>
                  {missingFields.includes('Highest Qualification') && (
                    <Badge variant="outline" className="text-destructive border-destructive">
                      Required
                    </Badge>
                  )}
                </div>
                <Select
                  name="highest_qualification"
                  value={formData.highest_qualification}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, highest_qualification: value }))}
                >
                  <SelectTrigger className={missingFields.includes('Highest Qualification') ? "border-destructive" : ""}>
                    <SelectValue placeholder="Select qualification" />
                  </SelectTrigger>
                  <SelectContent>
                    {QUALIFICATION_OPTIONS.map((qual) => (
                      <SelectItem key={qual} value={qual}>
                        {qual}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Degree Field */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="degree">Degree/Course Name</Label>
                  {missingFields.includes('Degree') && (
                    <Badge variant="outline" className="text-destructive border-destructive">
                      Required
                    </Badge>
                  )}
                </div>
                <Input
                  id="degree"
                  name="degree"
                  placeholder="E.g., B.Tech in Computer Science"
                  value={formData.degree}
                  onChange={handleChange}
                  className={missingFields.includes('Degree') ? "border-destructive" : ""}
                />
              </div>
              
              {/* CGPA Field */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="cgpa">CGPA/Percentage</Label>
                  {missingFields.includes('CGPA') && (
                    <Badge variant="outline" className="text-destructive border-destructive">
                      Required
                    </Badge>
                  )}
                </div>
                <Input
                  id="cgpa"
                  name="cgpa"
                  placeholder="Your CGPA or percentage"
                  value={formData.cgpa}
                  onChange={handleChange}
                  className={missingFields.includes('CGPA') ? "border-destructive" : ""}
                />
              </div>
              
              {/* Graduation Year Field */}
              <div className="space-y-2">
                <Label htmlFor="grad_year">Graduation Year</Label>
                <Select
                  name="grad_year"
                  value={formData.grad_year.toString()}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, grad_year: parseInt(value, 10) }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + 5 - i).map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* 10th Percentage Field */}
              <div className="space-y-2">
                <Label htmlFor="tenth_percent">10th Percentage</Label>
                <Input
                  id="tenth_percent"
                  name="tenth_percent"
                  placeholder="Your 10th grade percentage"
                  value={formData.tenth_percent}
                  onChange={handleChange}
                />
              </div>
              
              {/* 12th Percentage Field */}
              <div className="space-y-2">
                <Label htmlFor="twelfth_percent">12th Percentage</Label>
                <Input
                  id="twelfth_percent"
                  name="twelfth_percent"
                  placeholder="Your 12th grade percentage"
                  value={formData.twelfth_percent}
                  onChange={handleChange}
                />
              </div>
            </CardContent>
          </Card>
          
          {/* Location Preference Section */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Location Preference
              </CardTitle>
              <CardDescription>
                Where would you prefer to work?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Location Preference Field */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="location_pref">Preferred Location</Label>
                  {missingFields.includes('Preferred Location') && (
                    <Badge variant="outline" className="text-destructive border-destructive">
                      Required
                    </Badge>
                  )}
                </div>
                <Input
                  id="location_pref"
                  name="location_pref"
                  placeholder="E.g., Mumbai, Delhi, Remote"
                  value={formData.location_pref}
                  onChange={handleChange}
                  className={missingFields.includes('Preferred Location') ? "border-destructive" : ""}
                />
              </div>
              
              {/* Pincode Field */}
              <div className="space-y-2">
                <Label htmlFor="pincode">Pincode</Label>
                <Input
                  id="pincode"
                  name="pincode"
                  placeholder="Your area pincode"
                  value={formData.pincode}
                  onChange={handleChange}
                />
              </div>
              
              {/* Willing Radius Field */}
              <div className="space-y-2">
                <Label htmlFor="willing_radius_km">Willing to Travel (km)</Label>
                <Select
                  name="willing_radius_km"
                  value={formData.willing_radius_km.toString()}
                  onValueChange={(value) => setFormData(prev => 
                    ({ ...prev, willing_radius_km: parseInt(value, 10) }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select distance" />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 10, 15, 20, 25, 30, 50, 100].map((km) => (
                      <SelectItem key={km} value={km.toString()}>
                        {km} km
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
          
          {/* Skills & Languages Section */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5 text-primary" />
                Skills & Languages
              </CardTitle>
              <CardDescription>
                Your technical skills and languages you speak
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Skills Field */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="skills">Skills</Label>
                  {missingFields.includes('Skills') && (
                    <Badge variant="outline" className="text-destructive border-destructive">
                      Required
                    </Badge>
                  )}
                </div>
                {isLoadingSkills ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span className="text-sm text-muted-foreground">Loading skills...</span>
                  </div>
                ) : (
                <div className="flex flex-wrap gap-2">
                    {availableSkills.map((skill) => (
                        <Badge 
                        key={skill.skill_code} 
                        variant={formData.selectedSkills.includes(skill.skill_code) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleSkill(skill)}
                        >
                        {skill.name}
                        </Badge>
                    ))}
                </div>
                )}
              </div>
              
              {/* Languages Field */}
              <div className="space-y-2">
                <Label htmlFor="languages">
                  <div className="flex items-center gap-1">
                    <Languages className="h-4 w-4" />
                    Languages You Speak
                  </div>
                </Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    id="language-input"
                    placeholder="Add a language"
                    value={languageInput}
                    onChange={(e) => setLanguageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addLanguage();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={addLanguage}>
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.languages.map((language) => (
                    <Badge 
                      key={language} 
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      {language}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => removeLanguage(language)}
                      />
                    </Badge>
                  ))}
                  {formData.languages.length === 0 && (
                    <span className="text-sm text-muted-foreground">No languages added yet.</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Resume Section */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Resume & Summary
              </CardTitle>
              <CardDescription>
                Upload your resume and add a professional summary
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Resume URL Field */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="resume_url">Resume URL</Label>
                  {missingFields.includes('Resume') && (
                    <Badge variant="outline" className="text-destructive border-destructive">
                      Required
                    </Badge>
                  )}
                </div>
                <Input
                  id="resume_url"
                  name="resume_url"
                  placeholder="Link to your resume (Google Drive, Dropbox, etc.)"
                  value={formData.resume_url}
                  onChange={handleChange}
                  className={missingFields.includes('Resume') ? "border-destructive" : ""}
                />
              </div>
              
              {/* Resume Summary Field */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="resume_summary">Professional Summary</Label>
                  {missingFields.includes('Resume Summary') && (
                    <Badge variant="outline" className="text-destructive border-destructive">
                      Required
                    </Badge>
                  )}
                </div>
                <Textarea
                  id="resume_summary"
                  name="resume_summary"
                  placeholder="A brief summary of your skills, experience, and career goals"
                  rows={5}
                  value={formData.resume_summary}
                  onChange={handleChange}
                  className={missingFields.includes('Resume Summary') ? "border-destructive" : ""}
                />
              </div>
            </CardContent>
          </Card>
          
          {/* Submit Button */}
          <div className="flex justify-end">
            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating Profile...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Profile
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}