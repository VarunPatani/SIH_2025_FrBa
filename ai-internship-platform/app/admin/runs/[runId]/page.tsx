"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PortalNav } from "@/components/navigation/portal-nav"
import { Loader2, ArrowLeft } from "lucide-react"
import { runResults } from "@/app/api"
import { toast } from "sonner"
import Link from "next/link"

export default function RunResultsPage() {
  const params = useParams()
  const runId = params.runId
  const [loading, setLoading] = useState(true)
  const [runData, setRunData] = useState(null)
  const [matches, setMatches] = useState([])
  const [stats, setStats] = useState(null)

  const navItems = [
    { label: "Dashboard", href: "/admin/dashboard", active: false },
    { label: "System Logs", href: "/admin/logs" },
    { label: "User Management", href: "/admin/users" },
  ]

  useEffect(() => {
    async function fetchRunResults() {
      try {
        setLoading(true)
        // Fetch results for this specific run
        const data = await runResults(runId)
        
        if (!data) {
          toast.error("Failed to fetch run results")
          return
        }
        
        setRunData(data.run)
        setStats(data.stats)
        
        // Process the matches to extract component scores from component_json
        const processedMatches = data.matches.map(match => {
          // Parse the component_json if it exists and is a string
          let components = {}
          try {
            if (match.component_json) {
              components = typeof match.component_json === 'string' 
                ? JSON.parse(match.component_json) 
                : match.component_json;
            }
          } catch (e) {
            console.error("Error parsing component_json", e);
            components = {};
          }
          
          return {
            ...match,
            // Extract scores from component_json
            skill_score: components.skill_score || 0,
            location_score: components.location_score || 0,
            cgpa_score: components.cgpa_score || 0,
            // Use the already mapped score field (final_score)
          };
        });
        
        setMatches(processedMatches || []);
      } catch (error) {
        console.error("Error fetching run results:", error)
        toast.error("Failed to load allocation results")
      } finally {
        setLoading(false)
      }
    }

    if (runId) {
      fetchRunResults()
    }
  }, [runId])

  return (
    <div className="min-h-screen bg-background">
      <PortalNav portalName="Admin Control Panel" userName="System Admin" currentPage="Run Results" navItems={navItems} />

      <main className="container mx-auto px-4 py-8">
        {/* Back button */}
        <div className="mb-6">
          <Link href="/admin/dashboard">
            <Button variant="ghost" className="pl-0">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Run #{runId} Results</h1>
          {runData && (
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <div>Status: <Badge variant="outline">{runData.status}</Badge></div>
              <div>Date: {new Date(runData.created_at).toLocaleString()}</div>
              <div>Matches: {stats?.match_count || 0}</div>
              <div>Algorithm: {runData.algorithm || "greedy"}</div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Run Configuration */}
            {runData && (
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>Allocation Configuration</CardTitle>
                  <CardDescription>Parameters used for this matching run</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <h3 className="font-medium">Skill Weight</h3>
                      <p className="text-2xl">{(runData.skill_weight * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                      <h3 className="font-medium">Location Weight</h3>
                      <p className="text-2xl">{(runData.location_weight * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                      <h3 className="font-medium">CGPA Weight</h3>
                      <p className="text-2xl">{(runData.cgpa_weight * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                  
                  {/* Additional Configuration Details */}
                  <div className="mt-6 pt-4 border-t">
                    <h3 className="font-medium mb-2">Additional Configuration</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm text-muted-foreground">Respect Existing Matches:</span>
                        <span className="ml-2">{runData.respect_existing ? "Yes" : "No"}</span>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Total Matched Students:</span>
                        <span className="ml-2">{stats?.students_matched || 0}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Matches Table */}
            <Card>
              <CardHeader>
                <CardTitle>Match Results</CardTitle>
                <CardDescription>All candidate-internship matches generated in this run</CardDescription>
              </CardHeader>
              <CardContent>
                {matches.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No matches found for this run
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Candidate</TableHead>
                        <TableHead>Internship</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Match Score</TableHead>
                        <TableHead>Skill Score</TableHead>
                        <TableHead>CGPA</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {matches.map((match, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{match.student_name}</TableCell>
                          <TableCell>{match.internship_title}</TableCell>
                          <TableCell>{match.company_name}</TableCell>
                          <TableCell>{match.location || "N/A"}</TableCell>
                          <TableCell>
                            <span className="font-semibold">
                              {(match.score * 10).toFixed(1)}
                            </span>
                            /10
                          </TableCell>
                          <TableCell>{(match.skill_score * 100).toFixed(0)}%</TableCell>
                          <TableCell>{match.student_cgpa}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}