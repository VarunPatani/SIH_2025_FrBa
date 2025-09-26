"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { PortalNav } from "@/components/navigation/portal-nav"
import { BreadcrumbNav } from "@/components/navigation/breadcrumb-nav"
import { Plus, X, Loader2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { createInternship } from "@/app/api"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

const SKILLS_OPTIONS = [
  "JavaScript", "Python", "React", "Node.js", "Java", "C++", "HTML/CSS", 
  "TypeScript", "SQL", "Git", "Docker", "AWS", "Machine Learning", 
  "Data Analysis", "UI/UX Design", "Project Management", "Spring Boot", 
  "MongoDB", "PostgreSQL", "Redis", "Kubernetes", "GraphQL",
]

const JOB_ROLES = [
  { code: "SWE", name: "Software Engineer" },
  { code: "DA", name: "Data Analyst" },
  { code: "PM", name: "Product Manager" },
  { code: "UIUX", name: "UI/UX Designer" },
  { code: "QA", name: "Quality Assurance" },
  { code: "DEVOPS", name: "DevOps Engineer" },
  { code: "BA", name: "Business Analyst" },
]

const CATEGORIES = [
  { code: "GEN", name: "General" },
  { code: "OBC", name: "OBC" },
  { code: "SC", name: "SC" },
  { code: "ST", name: "ST" },
  { code: "PWD", name: "Persons with Disability" },
]

const LANGUAGES = [
  "English", "Hindi", "Marathi", "Gujarati", "Tamil", 
  "Telugu", "Kannada", "Malayalam", "Bengali", "Punjabi"
]

interface Skill {
  name: string
  weight: number
}

interface CategoryQuota {
  category: string
  percentage: number
}

export default function PostInternshipPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [companyData, setCompanyData] = useState(null);

  useEffect(() => {
    const user = localStorage.getItem("companyUser")
    if (!user) {
      router.push("/company/login")
      return
    }
    const companyUser = JSON.parse(user)
    setCompanyData(companyUser)
  }, [router]);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    capacity: "1",
    min_cgpa: "0",
    location: "",
    pincode: "",
    job_role_code: "",
    nsqf_required_level: "1",
    min_age: "18",
    is_shift_night: false,
    wage_min: "",
    wage_max: "",
    skills: [] as Skill[],
    genders: {
      male: true,
      female: true,
      other: true
    },
    languages: {} as Record<string, boolean>,
    categoryQuotas: [] as CategoryQuota[],
    is_active: true
  });

  const [skillInput, setSkillInput] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [quotaPercentage, setQuotaPercentage] = useState("");

  const navItems = [
    { label: "Dashboard", href: "/company/dashboard" },
    { label: "Post Internship", href: "/company/post-internship", active: true },
    { label: "Analytics", href: "/company/analytics" },
  ];

  const breadcrumbItems = [
    { label: "Company Portal", href: "/company/dashboard" }, 
    { label: "Post New Internship" }
  ];

  const addSkill = (skillName: string) => {
    if (skillName && !formData.skills.find((s) => s.name === skillName)) {
      setFormData({
        ...formData,
        skills: [...formData.skills, { name: skillName, weight: 5 }],
      })
    }
    setSkillInput("")
  };

  const removeSkill = (skillName: string) => {
    setFormData({
      ...formData,
      skills: formData.skills.filter((s) => s.name !== skillName),
    })
  };

  const updateSkillWeight = (skillName: string, weight: number) => {
    setFormData({
      ...formData,
      skills: formData.skills.map((s) => (s.name === skillName ? { ...s, weight } : s)),
    })
  };

  const toggleLanguage = (language: string) => {
    setFormData({
      ...formData,
      languages: {
        ...formData.languages,
        [language]: !formData.languages[language]
      }
    });
  };

  const addCategoryQuota = () => {
    if (selectedCategory && quotaPercentage) {
      if (!formData.categoryQuotas.find(q => q.category === selectedCategory)) {
        setFormData({
          ...formData,
          categoryQuotas: [
            ...formData.categoryQuotas,
            { category: selectedCategory, percentage: parseInt(quotaPercentage) }
          ]
        });
        setSelectedCategory("");
        setQuotaPercentage("");
      } else {
        toast.error("This category already has a quota set");
      }
    }
  };

  const removeCategoryQuota = (category: string) => {
    setFormData({
      ...formData,
      categoryQuotas: formData.categoryQuotas.filter(q => q.category !== category)
    });
  };

  const validateForm = () => {
    if (!formData.title) {
      toast.error("Internship title is required");
      return false;
    }
    if (!formData.description) {
      toast.error("Description is required");
      return false;
    }
    if (!formData.capacity || parseInt(formData.capacity) < 1) {
      toast.error("Capacity must be at least 1");
      return false;
    }
    if (!formData.location) {
      toast.error("Location is required");
      return false;
    }
    return true;
  };

  const handlePublish = async () => {
    if (!validateForm()) return;
    
    try {
      setLoading(true);
      
      // Format the data for API
      const skillsText = formData.skills.map(s => `${s.name} (${s.weight})`).join(', ');
      const languagesArray = Object.entries(formData.languages)
        .filter(([_, selected]) => selected)
        .map(([lang]) => lang);
      
      const internshipData = {
        org_id: companyData.id,
        org_name: companyData.name,
        title: formData.title,
        description: formData.description,
        req_skills_text: skillsText,
        capacity: parseInt(formData.capacity),
        min_cgpa: parseFloat(formData.min_cgpa),
        location: formData.location,
        pincode: formData.pincode,
        job_role_code: formData.job_role_code,
        nsqf_required_level: parseInt(formData.nsqf_required_level),
        min_age: parseInt(formData.min_age),
        genders_allowed: JSON.stringify(formData.genders),
        languages_required_json: JSON.stringify(languagesArray),
        is_shift_night: formData.is_shift_night,
        wage_min: formData.wage_min ? parseInt(formData.wage_min) : null,
        wage_max: formData.wage_max ? parseInt(formData.wage_max) : null,
        category_quota_json: JSON.stringify(
          Object.fromEntries(formData.categoryQuotas.map(q => [q.category, q.percentage]))
        ),
        is_active: formData.is_active
      };
      
      const response = await createInternship(internshipData);
      
      toast.success("Internship posted successfully!");
      router.push("/company/dashboard");
      
    } catch (error) {
      console.error("Error posting internship:", error);
      toast.error("Failed to post internship. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!validateForm()) return;
    
    try {
      setLoading(true);
      
      // Same as publish but set is_active to false
      const skillsText = formData.skills.map(s => `${s.name} (${s.weight})`).join(', ');
      const languagesArray = Object.entries(formData.languages)
        .filter(([_, selected]) => selected)
        .map(([lang]) => lang);
      
      const internshipData = {
        org_id: companyData.id,
        org_name: companyData.name,
        title: formData.title,
        description: formData.description,
        req_skills_text: skillsText,
        capacity: parseInt(formData.capacity),
        min_cgpa: parseFloat(formData.min_cgpa),
        location: formData.location,
        pincode: formData.pincode,
        job_role_code: formData.job_role_code,
        nsqf_required_level: parseInt(formData.nsqf_required_level),
        min_age: parseInt(formData.min_age),
        genders_allowed: JSON.stringify(formData.genders),
        languages_required_json: JSON.stringify(languagesArray),
        is_shift_night: formData.is_shift_night,
        wage_min: formData.wage_min ? parseInt(formData.wage_min) : null,
        wage_max: formData.wage_max ? parseInt(formData.wage_max) : null,
        category_quota_json: JSON.stringify(
          Object.fromEntries(formData.categoryQuotas.map(q => [q.category, q.percentage]))
        ),
        is_active: false // Save as draft = not active
      };
      
      const response = await createInternship(internshipData);
      
      toast.success("Internship saved as draft!");
      router.push("/company/dashboard");
      
    } catch (error) {
      console.error("Error saving internship draft:", error);
      toast.error("Failed to save draft. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!companyData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-lg font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PortalNav 
        portalName="Company Portal" 
        userName={companyData?.name || ""} 
        currentPage="Post Internship" 
        navItems={navItems} 
      />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <BreadcrumbNav items={breadcrumbItems} />

          <Card className="border-border shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">Post New Internship</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-6">
                <h3 className="text-lg font-medium">Basic Information</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Internship Title<span className="text-red-500">*</span></Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g., Frontend Developer Intern"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capacity">Capacity<span className="text-red-500">*</span></Label>
                    <Input
                      id="capacity"
                      type="number"
                      min="1"
                      value={formData.capacity}
                      onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                      placeholder="Number of positions"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="job_role">Job Role</Label>
                    <Select
                      value={formData.job_role_code}
                      onValueChange={(value) => setFormData({ ...formData, job_role_code: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a job role" />
                      </SelectTrigger>
                      <SelectContent>
                        {JOB_ROLES.map(role => (
                          <SelectItem key={role.code} value={role.code}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nsqf_level">NSQF Required Level</Label>
                    <Input
                      id="nsqf_level"
                      type="number"
                      min="1"
                      max="10"
                      value={formData.nsqf_required_level}
                      onChange={(e) => setFormData({ ...formData, nsqf_required_level: e.target.value })}
                      placeholder="NSQF Level"
                    />
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="space-y-6">
                <h3 className="text-lg font-medium">Location</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="location">Location<span className="text-red-500">*</span></Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="e.g., Mumbai, Maharashtra"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pincode">Pincode</Label>
                    <Input
                      id="pincode"
                      value={formData.pincode}
                      maxLength={6}
                      onChange={(e) => setFormData({ ...formData, pincode: e.target.value.replace(/[^0-9]/g, '') })}
                      placeholder="e.g., 400001"
                    />
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Internship Description<span className="text-red-500">*</span></Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Provide a detailed description of the internship role, responsibilities, and requirements..."
                  rows={6}
                />
              </div>

              {/* Eligibility Criteria */}
              <div className="space-y-6">
                <h3 className="text-lg font-medium">Eligibility Criteria</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="min_cgpa">Minimum CGPA</Label>
                    <Input
                      id="min_cgpa"
                      type="number"
                      min="0"
                      max="10"
                      step="0.01"
                      value={formData.min_cgpa}
                      onChange={(e) => setFormData({ ...formData, min_cgpa: e.target.value })}
                      placeholder="e.g., 7.5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="min_age">Minimum Age</Label>
                    <Input
                      id="min_age"
                      type="number"
                      min="15"
                      value={formData.min_age}
                      onChange={(e) => setFormData({ ...formData, min_age: e.target.value })}
                      placeholder="e.g., 18"
                    />
                  </div>
                </div>

                {/* Gender */}
                <div className="space-y-2">
                  <Label>Gender Eligibility</Label>
                  <div className="flex flex-wrap gap-4 pt-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="gender_male"
                        checked={formData.genders.male}
                        onCheckedChange={(checked) => setFormData({
                          ...formData, 
                          genders: {...formData.genders, male: !!checked}
                        })}
                      />
                      <label htmlFor="gender_male" className="text-sm">Male</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="gender_female"
                        checked={formData.genders.female}
                        onCheckedChange={(checked) => setFormData({
                          ...formData, 
                          genders: {...formData.genders, female: !!checked}
                        })}
                      />
                      <label htmlFor="gender_female" className="text-sm">Female</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="gender_other"
                        checked={formData.genders.other}
                        onCheckedChange={(checked) => setFormData({
                          ...formData, 
                          genders: {...formData.genders, other: !!checked}
                        })}
                      />
                      <label htmlFor="gender_other" className="text-sm">Other</label>
                    </div>
                  </div>
                </div>

                {/* Category Quotas */}
                <div className="space-y-4">
                  <Label>Category Quotas</Label>
                  <div className="flex items-end gap-2">
                    <div className="space-y-2 flex-1">
                      <Label htmlFor="category">Category</Label>
                      <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map(cat => (
                            <SelectItem key={cat.code} value={cat.code}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 w-24">
                      <Label htmlFor="quota_percentage">Percentage</Label>
                      <Input 
                        id="quota_percentage"
                        type="number"
                        min="1"
                        max="100"
                        value={quotaPercentage}
                        onChange={(e) => setQuotaPercentage(e.target.value)}
                        placeholder="%"
                      />
                    </div>
                    <Button 
                      type="button" 
                      onClick={addCategoryQuota} 
                      disabled={!selectedCategory || !quotaPercentage}
                      className="mb-px"
                    >
                      Add
                    </Button>
                  </div>

                  {formData.categoryQuotas.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {formData.categoryQuotas.map(quota => (
                        <Badge key={quota.category} variant="secondary" className="flex items-center gap-1">
                          {CATEGORIES.find(c => c.code === quota.category)?.name} ({quota.percentage}%)
                          <button
                            type="button"
                            onClick={() => removeCategoryQuota(quota.category)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Languages */}
              <div className="space-y-4">
                <Label>Required Languages</Label>
                <div className="flex flex-wrap gap-3">
                  {LANGUAGES.map(language => (
                    <div key={language} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`lang_${language}`}
                        checked={formData.languages[language] || false}
                        onCheckedChange={() => toggleLanguage(language)}
                      />
                      <label htmlFor={`lang_${language}`} className="text-sm">{language}</label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Work Details */}
              <div className="space-y-6">
                <h3 className="text-lg font-medium">Work Details</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="wage_min">Minimum Stipend (₹/month)</Label>
                    <Input
                      id="wage_min"
                      type="number"
                      min="0"
                      value={formData.wage_min}
                      onChange={(e) => setFormData({ ...formData, wage_min: e.target.value })}
                      placeholder="e.g., 10000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wage_max">Maximum Stipend (₹/month)</Label>
                    <Input
                      id="wage_max"
                      type="number"
                      min="0"
                      value={formData.wage_max}
                      onChange={(e) => setFormData({ ...formData, wage_max: e.target.value })}
                      placeholder="e.g., 15000"
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2 pt-2">
                  <Switch
                    id="night_shift"
                    checked={formData.is_shift_night}
                    onCheckedChange={(checked) => setFormData({
                      ...formData, 
                      is_shift_night: checked
                    })}
                  />
                  <Label htmlFor="night_shift">Night Shift Required</Label>
                </div>
              </div>

              {/* Required Skills */}
              <div className="space-y-4">
                <Label>Required Skills</Label>

                {/* Add Skills */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      placeholder="Type a skill..."
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          addSkill(skillInput)
                        }
                      }}
                    />
                    <Button type="button" onClick={() => addSkill(skillInput)} size="icon">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Popular Skills */}
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Popular Skills:</p>
                    <div className="flex flex-wrap gap-2">
                      {SKILLS_OPTIONS.map((skill) => (
                        <Button
                          key={skill}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addSkill(skill)}
                          disabled={formData.skills.find((s) => s.name === skill) !== undefined}
                        >
                          {skill}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Selected Skills with Weights */}
                {formData.skills.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Selected Skills & Importance Weights:</p>
                    <div className="space-y-3">
                      {formData.skills.map((skill) => (
                        <div key={skill.name} className="flex items-center gap-3 p-3 border border-border rounded-lg">
                          <Badge variant="secondary" className="flex items-center gap-1">
                            {skill.name}
                            <button
                              type="button"
                              onClick={() => removeSkill(skill.name)}
                              className="ml-1 hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`weight-${skill.name}`} className="text-sm">
                              Importance:
                            </Label>
                            <Input
                              id={`weight-${skill.name}`}
                              type="number"
                              min="1"
                              max="10"
                              value={skill.weight}
                              onChange={(e) => updateSkillWeight(skill.name, Number.parseInt(e.target.value) || 1)}
                              className="w-20"
                            />
                            <span className="text-sm text-muted-foreground">/10</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-4 pt-6 border-t border-border">
                <Button 
                  variant="outline" 
                  onClick={handleSaveDraft}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Draft"
                  )}
                </Button>
                <Button 
                  onClick={handlePublish}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    "Publish Internship"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}