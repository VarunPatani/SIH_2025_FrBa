"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarInitials } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Bell, ArrowLeft, CheckCircle2, Download, Star, GraduationCap, MapPin, LogOut, Loader2, Mail, Phone, Calendar, Award, Briefcase } from "lucide-react"
import Link from "next/link"
import { getCandidateDetails, shortlistCandidate } from "@/app/api"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

export default function CandidateProfilePage({ params }: { params: { id: string, student_id: string } }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const internshipId = params.id;
  const studentId = params.student_id;
  const matchScore = searchParams.get('matchScore') || "0"
  
  const [companyData, setCompanyData] = useState(null)
  const [candidate, setCandidate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [shortlisting, setShortlisting] = useState(false)
  const [isShortlisted, setIsShortlisted] = useState(false)
  useEffect(() => {
    // Check if user is logged in
    const user = localStorage.getItem("companyUser")
    if (!user) {
      router.push("/company/login")
      return
    }

    const companyUser = JSON.parse(user)
    setCompanyData(companyUser)

    // Fetch candidate details
    const fetchCandidate = async () => {
      try {
        setLoading(true)
        console.log("Fetching details for student ID:", studentId)
        const candidateData = await getCandidateDetails(studentId)
        
        setCandidate({
          id: candidateData.student_id,
          name: candidateData.name || "Anonymous",
          email: candidateData.email || "",
          phone: candidateData.phone || "Not provided",
          degree: candidateData.degree || "Not specified",
          university: candidateData.degree || "Not specified",
          graduationYear: candidateData.grad_year || "N/A",
          cgpa: candidateData.cgpa || "N/A",
          location: candidateData.location_pref || "Not specified",
          skills: candidateData.skills_text 
            ? candidateData.skills_text.split(',').map(skill => skill.trim()).filter(s => s)
            : [],
          resumeUrl: candidateData.resume_url || "",
          resumeSummary: candidateData.resume_summary || "No resume summary available.",
          tenthPercent: candidateData.tenth_percent || "N/A",
          twelfthPercent: candidateData.twelfth_percent || "N/A",
          highestQualification: candidateData.highest_qualification || "Not specified",
          category: candidateData.category_code || "N/A",
          // Check if the candidate is already shortlisted for this internship
          isShortlisted: candidateData.shortlisted_for?.includes(Number(internshipId)) || false
        })
        
        setIsShortlisted(candidateData.shortlisted_for?.includes(Number(internshipId)) || false)
        setLoading(false)
      } catch (err) {
        console.error(err)
        setError("Failed to load candidate data")
        setLoading(false)
      }
    }

    fetchCandidate()
  }, [params.id, internshipId, router])

  const handleShortlist = async () => {
    try {
      if (!internshipId) {
        toast.error("No internship selected")
        return
      }
      
      setShortlisting(true)
      await shortlistCandidate(internshipId, studentId)
      setIsShortlisted(true)
      toast.success(`${candidate.name} has been shortlisted for this internship`)
      setShortlisting(false)
    } catch (err) {
      console.error(err)
      toast.error("Failed to shortlist candidate")
      setShortlisting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-lg font-medium">Loading candidate profile...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
            <Button 
              className="mt-4" 
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-xl font-bold text-primary">
                InternAI
              </Link>
              <span className="text-sm text-muted-foreground">Company Portal</span>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon">
                <Bell className="h-5 w-5" />
              </Button>
              <Avatar>
                <AvatarFallback>
                  <AvatarInitials name={companyData?.name || ""} />
                </AvatarFallback>
              </Avatar>
              <Button variant="ghost" size="icon" onClick={() => {
                localStorage.removeItem("companyUser");
                router.push("/company/login");
              }}>
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Back Link */}
        <Link
          href={internshipId ? `/company/applicants/${internshipId}` : "/company/dashboard"}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to {internshipId ? "Applicants" : "Dashboard"}
        </Link>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Profile Summary Card */}
          <Card className="md:col-span-1">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center">
                <Avatar className="h-20 w-20 mb-4">
                  <AvatarFallback className="text-2xl">
                    <AvatarInitials name={candidate?.name || ""} />
                  </AvatarFallback>
                </Avatar>
                <h2 className="text-xl font-bold text-center">{candidate?.name}</h2>
                <p className="text-sm text-muted-foreground text-center mb-4">{candidate?.degree}</p>
                
                {Number(matchScore) > 0 && (
                  <div className="mb-6 text-center">
                    <Badge className="text-sm px-2 py-1 bg-primary/10 text-primary border-primary/20">
                      <Star className="h-3 w-3 mr-1 fill-primary text-primary" /> 
                      {matchScore}% Match Score
                    </Badge>
                  </div>
                )}
                
                <div className="w-full space-y-3">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{candidate?.email}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{candidate?.phone}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{candidate?.location}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Graduating {candidate?.graduationYear}</span>
                  </div>
                </div>
                
                <Separator className="my-6" />
                
                {internshipId && (
                  <Button
                    className="w-full"
                    onClick={handleShortlist}
                    disabled={isShortlisted || shortlisting}
                  >
                    {shortlisting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : isShortlisted ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Shortlisted
                      </>
                    ) : (
                      "Shortlist Candidate"
                    )}
                  </Button>
                )}
                
                {candidate?.resumeUrl && (
                  <Button 
                    variant="outline" 
                    className="w-full mt-3"
                    onClick={() => window.open(candidate.resumeUrl, '_blank')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Resume
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Detailed Info */}
          <div className="md:col-span-2 space-y-6">
            {/* Education */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Education
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {candidate?.degree && (
                    <div className="bg-card/50 p-4 rounded-md border border-border/50">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{candidate.degree}</p>
                          <p className="text-sm text-muted-foreground">
                            Graduation Year: {candidate.graduationYear}
                          </p>
                        </div>
                        <Badge>CGPA: {candidate.cgpa}</Badge>
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <p className="text-sm text-muted-foreground">12th Standard</p>
                      <p className="font-medium">{candidate?.twelfthPercent}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">10th Standard</p>
                      <p className="font-medium">{candidate?.tenthPercent}%</p>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm text-muted-foreground">Highest Qualification</p>
                    <p className="font-medium">{candidate?.highestQualification}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Skills */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Skills
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {candidate?.skills.map((skill) => (
                    <Badge key={skill} variant="secondary" className="px-3 py-1">
                      {skill}
                    </Badge>
                  ))}
                  
                  {candidate?.skills.length === 0 && (
                    <p className="text-sm text-muted-foreground">No skills listed</p>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* Resume Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Resume Summary
                </CardTitle>
                <CardDescription>
                  AI-generated summary of the candidate's resume
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-card/50 p-4 rounded-md border border-border/50">
                  <p className="text-sm whitespace-pre-line">{candidate?.resumeSummary}</p>
                </div>
              </CardContent>
            </Card>
            
            {/* Action Buttons */}
            {internshipId && (
              <Card>
                <CardFooter className="flex justify-between pt-6">
                  <Button variant="outline" onClick={() => router.back()}>
                    Back to Applicants
                  </Button>
                  <Button 
                    onClick={handleShortlist}
                    disabled={isShortlisted || shortlisting}
                    className="min-w-[150px]"
                  >
                    {shortlisting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : isShortlisted ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Shortlisted
                      </>
                    ) : (
                      "Shortlist Candidate"
                    )}
                  </Button>
                </CardFooter>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}