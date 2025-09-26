"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Pagination } from "@/components/ui/pagination"
import { PortalNav } from "@/components/navigation/portal-nav"
import { 
  Settings, Play, Eye, Activity, Clock, CheckCircle, XCircle, 
  Loader2, AlertTriangle, Hourglass as HourglassIcon 
} from "lucide-react"
import { runAllocation, latestRun, getAllocationRuns, runResults } from "@/app/api"
import { toast } from "sonner"

export default function AdminDashboardPage() {
  const adminName = "System Admin"
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [totalRuns, setTotalRuns] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const runsPerPage = 10
  
  // Use an empty array as initial state
  const [matchingRuns, setMatchingRuns] = useState([])

  const navItems = [
    { label: "Dashboard", href: "/admin/dashboard", active: true },
    { label: "System Logs", href: "/admin/logs" },
    { label: "User Management", href: "/admin/users" },
  ]

  const [matchingConfig, setMatchingConfig] = useState({
    skillWeightMultiplier: [6.5],
    locationPreferenceFactor: [2.0],
    cgpaWeight: [1.5],
    experienceWeight: [0],  // Not currently used in backend
    availabilityWeight: [0], // Not currently used in backend
  })

  const [stats, setStats] = useState([
    { label: "Total Candidates", value: "0", icon: "👥" },
    { label: "Active Internships", value: "0", icon: "💼" },
    { label: "Successful Matches", value: "0", icon: "🎯" },
    { label: "System Uptime", value: "99.9%", icon: "⚡" },
  ])
  // Add this function after your other handler functions before the return statement

  const handleViewResults = (runId) => {
    // Navigate to the run results page
    window.location.href = `/admin/runs/${runId}`;
  }
  const getStatusColor = (status) => {
    switch (status) {
      case "SUCCESS":
        return "bg-green-100 text-green-800"
      case "FAILED":
        return "bg-red-100 text-red-800"
      case "RUNNING":
        return "bg-blue-100 text-blue-800"
      case "QUEUED":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case "SUCCESS":
        return <CheckCircle className="h-4 w-4" />
      case "FAILED":
        return <XCircle className="h-4 w-4" />
      case "RUNNING":
        return <Activity className="h-4 w-4 animate-pulse" />
      case "QUEUED":
        return <HourglassIcon className="h-4 w-4" />
      default:
        return <AlertTriangle className="h-4 w-4" />
    }
  }

  const handleExecuteMatching = async () => {
    try {
      setLoading(true);
      
      // Convert slider values to actual weights
      // Normalize them to sum to 1.0
      const skillWeight = matchingConfig.skillWeightMultiplier[0] / 10;
      const locationWeight = matchingConfig.locationPreferenceFactor[0] / 10;
      const cgpaWeight = matchingConfig.cgpaWeight[0] / 10;
      
      // Normalize to ensure they sum to 1.0
      const totalWeight = skillWeight + locationWeight + cgpaWeight;
      const normalizedSkillWeight = skillWeight / totalWeight;
      const normalizedLocationWeight = locationWeight / totalWeight;
      const normalizedCgpaWeight = cgpaWeight / totalWeight;
      
      const response = await runAllocation({
        skill_weight: normalizedSkillWeight,
        location_weight: normalizedLocationWeight, 
        cgpa_weight: normalizedCgpaWeight,
        respect_existing: true,
      });
      
      toast.success(`Matching process complete! ${response.match_count} matches generated.`);
      
      // Fetch the latest run data to update the UI
      fetchMatchingRuns();
      
    } catch (error) {
      console.error("Error executing matching process:", error);
      toast.error("Failed to complete matching process. Please try again.");
    } finally {
      setIsConfigModalOpen(false);
      setLoading(false);
    }
  }

  const fetchMatchingRuns = async () => {
    try {
      setLoading(true);
      
      // Calculate offset based on current page
      const offset = (currentPage - 1) * runsPerPage;
      
      // Fetch runs from database
      const data = await getAllocationRuns(runsPerPage, offset);
      
      if (!data || !data.runs) {
        console.log("Failed to fetch allocation runs");
        return;
      }
      
      // Set total count for pagination
      setTotalRuns(data.pagination.total);
      
      // Transform the database runs to match our UI format
      const formattedRuns = data.runs.map(run => {
        // Parse JSON fields only if they are strings
        const paramsJson = typeof run.params_json === 'string' 
          ? JSON.parse(run.params_json) 
          : run.params_json || {};
        const metricsJson = typeof run.metrics_json === 'string' 
          ? JSON.parse(run.metrics_json) 
          : run.metrics_json || {};
        return {
          id: `RUN_${run.run_id}`,
          rawId: run.run_id,
          status: run.status,
          timestamp: new Date(run.created_at).toLocaleString(),
          duration: "N/A", // Not available directly
          algorithm: paramsJson.algorithm || "N/A",
          weights: paramsJson.weights || {},
          matchesGenerated: run.match_count || 0,
          candidatesProcessed: run.students_matched || 0,
          internshipsProcessed: run.internships_matched || 0,
          avgScore: metricsJson.avg_score || 0,
          successRate: metricsJson.success_rate || 0,
          errorMessage: run.error_message || "",
          createdAt: run.created_at
        };
      });
      
      setMatchingRuns(formattedRuns);
      
      // Update dashboard stats based on latest run
      if (formattedRuns.length > 0) {
        // Get the most recent successful run
        const latestSuccessfulRun = formattedRuns.find(run => run.status === "SUCCESS") || formattedRuns[0];
        
        setStats([
          { label: "Total Candidates", value: latestSuccessfulRun.candidatesProcessed.toString(), icon: "👥" },
          { label: "Active Internships", value: latestSuccessfulRun.internshipsProcessed.toString(), icon: "💼" },
          { label: "Successful Matches", value: latestSuccessfulRun.matchesGenerated.toString(), icon: "🎯" },
          { label: "System Uptime", value: "99.9%", icon: "⚡" },
        ]);
      }
      
    } catch (error) {
      console.error("Error fetching matching runs:", error);
      toast.error("Failed to fetch matching runs data");
    } finally {
      setLoading(false);
    }
  };

  // Format algorithm name for display
  const formatAlgorithm = (algorithm) => {
    if (!algorithm) return "N/A";
    
    return algorithm
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Handle page change
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Call this on component mount or when page changes
  useEffect(() => {
    fetchMatchingRuns();
  }, [currentPage]);

  return (
    <div className="min-h-screen bg-background">
      <PortalNav portalName="Admin Control Panel" userName={adminName} currentPage="Dashboard" navItems={navItems} />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">AI Matching Control Panel</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Configure and execute the AI matching algorithm to connect candidates with their ideal internships.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-4 gap-6 mb-12">
          {stats.map((stat, index) => (
            <Card key={index}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  </div>
                  <div className="text-2xl">{stat.icon}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Action */}
        <div className="text-center mb-12">
          <Dialog open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="text-lg px-8 py-6">
                <Settings className="h-6 w-6 mr-3" />
                Configure & Run New Matching
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl">Configure Matching Parameters</DialogTitle>
                <DialogDescription>
                  Adjust the algorithm parameters to optimize the matching process for current data.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Skill Weight Multiplier */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="skillWeight">Skill Weight Multiplier</Label>
                    <span className="text-sm text-muted-foreground">{matchingConfig.skillWeightMultiplier[0]}</span>
                  </div>
                  <Slider
                    id="skillWeight"
                    min={1}
                    max={10}
                    step={0.5}
                    value={matchingConfig.skillWeightMultiplier}
                    onValueChange={(value) => setMatchingConfig({ ...matchingConfig, skillWeightMultiplier: value })}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Higher values prioritize skill matching over other factors
                  </p>
                </div>

                {/* Location Preference Factor */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="locationWeight">Location Preference Factor</Label>
                    <span className="text-sm text-muted-foreground">{matchingConfig.locationPreferenceFactor[0]}</span>
                  </div>
                  <Slider
                    id="locationWeight"
                    min={1}
                    max={10}
                    step={0.5}
                    value={matchingConfig.locationPreferenceFactor}
                    onValueChange={(value) => setMatchingConfig({ ...matchingConfig, locationPreferenceFactor: value })}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">Weight given to candidate location preferences</p>
                </div>

                {/* CGPA Weight */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="cgpaWeight">CGPA Weight</Label>
                    <span className="text-sm text-muted-foreground">{matchingConfig.cgpaWeight[0]}</span>
                  </div>
                  <Slider
                    id="cgpaWeight"
                    min={1}
                    max={10}
                    step={0.5}
                    value={matchingConfig.cgpaWeight}
                    onValueChange={(value) => setMatchingConfig({ ...matchingConfig, cgpaWeight: value })}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">Importance of academic performance in matching</p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsConfigModalOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleExecuteMatching} 
                  className="bg-primary"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Execute Matching Run
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Matching History */}
        <Card>
          <CardHeader>
            <CardTitle>Matching Run History</CardTitle>
            <CardDescription>Track the performance and results of previous AI matching executions</CardDescription>
          </CardHeader>
          <CardContent>
            {loading && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            
            {!loading && matchingRuns.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No matching runs found
              </div>
            )}
            
            {!loading && matchingRuns.length > 0 && (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Run ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Algorithm</TableHead>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Matches</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matchingRuns.map((run) => (
                      <TableRow key={run.id}>
                        <TableCell className="font-mono text-sm">#{run.rawId}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(run.status)}>
                            <div className="flex items-center gap-1">
                              {getStatusIcon(run.status)}
                              <span>{run.status}</span>
                            </div>
                          </Badge>
                        </TableCell>
                        <TableCell>{formatAlgorithm(run.algorithm)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{run.timestamp}</TableCell>
                        <TableCell className="font-medium">{run.matchesGenerated.toLocaleString()}</TableCell>
                        <TableCell>
                          {run.avgScore ? (
                            <div className="text-sm">
                              <span className="font-medium">{run.avgScore}/10</span>
                              {run.successRate && (
                                <span className="text-muted-foreground ml-2">
                                  ({Math.round(run.successRate * 100)}% rate)
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              disabled={run.status !== "SUCCESS"}
                              onClick={() => handleViewResults(run.rawId)} // Add this onClick handler
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Results
                            </Button>
                            
                            {run.status === "FAILED" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  toast.info(run.errorMessage || "Unknown error occurred");
                                }}
                              >
                                <AlertTriangle className="h-4 w-4 mr-1" />
                                Error
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {/* Pagination */}
                <div className="flex items-center justify-center space-x-2 py-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <div className="text-sm text-muted-foreground">
                    Page {currentPage} of {Math.ceil(totalRuns / runsPerPage)}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= Math.ceil(totalRuns / runsPerPage)}
                  >
                    Next
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}