"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProjectCard } from "@/components/ProjectCard";
import { useApi, Project, Deployment } from "@/lib/hooks";
import { 
  Github, 
  Plus, 
  Loader2,
  ExternalLink,
  X,
  Copy,
  CheckCircle2
} from "lucide-react";
import { Fira_Code } from "next/font/google";

const API_BASE_URL = "http://localhost:9000";
const REVERSE_PROXY_URL = "http://localhost:8000";
let socket: Socket;

const firaCode = Fira_Code({ subsets: ["latin"] });

export default function Home() {
  const {
    fetchProjects,
    fetchProject,
    fetchLogs,
    createProject: apiCreateProject,
    deployProject: apiDeployProject,
  } = useApi();

  const getProjectUrl = useCallback((project: Project) => {
    const customDomain = project.custom_domain?.trim();
    if (customDomain) {
      if (customDomain.startsWith("http://") || customDomain.startsWith("https://")) {
        return customDomain;
      }
      return `https://${customDomain}`;
    }
    return `http://${project.id}.localhost:8000`;
  }, []);

  const getDisplayUrl = useCallback(
    (project: Project) => getProjectUrl(project).replace(/^https?:\/\//, ""),
    [getProjectUrl]
  );

  const [projects, setProjects] = useState<Project[]>([]);
  const [currentDeployment, setCurrentDeployment] = useState<{
    projectId: string;
    deploymentId: string;
    project: Project | null;
  } | null>(null);
  const [logs, setLogs] = useState<Array<{ log: string; type: string; timestamp: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [deployLoadingMap, setDeployLoadingMap] = useState<Record<string, boolean>>({});
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectGitURL, setNewProjectGitURL] = useState("");
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [deploymentStatus, setDeploymentStatus] = useState<string>("QUEUED");
  const logContainerRef = useRef<HTMLDivElement>(null);
  const logPollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const logCountRef = useRef<number>(0);

  // Initialize socket connection
  useEffect(() => {
    socket = io(API_BASE_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socket.on("connect", () => {
      console.log("✅ Socket.io connected");
    });

    socket.on("disconnect", () => {
      console.log("❌ Socket.io disconnected");
    });

    socket.on("message", (message: string) => {
      console.log("📨 Socket message from Kafka:", message);
      try {
        const parsed = JSON.parse(message);
        // Only process real logs, not subscription confirmations
        if (parsed.log) {
          const newLog = {
            log: parsed.log,
            type: parsed.type || "log",
            timestamp: new Date().toLocaleTimeString(),
          };
          setLogs((prev) => [...prev, newLog]);
          logCountRef.current += 1;
          console.log(`📝 Log received from Kafka (${logCountRef.current}):`, parsed.log);

          // Auto-detect status from log content
          const logLower = parsed.log.toLowerCase();
          if (logLower.includes("build started") && deploymentStatus === "QUEUED") {
            setDeploymentStatus("IN_PROGRESS");
            console.log("🔄 Status changed to IN_PROGRESS (build started)");
          } else if (logLower.includes("done") || logLower.includes("uploaded successfully")) {
            setDeploymentStatus("READY");
            console.log("✅ Status changed to READY (build complete)");
          } else if (logLower.includes("error") || logLower.includes("failed")) {
            setDeploymentStatus("FAIL");
            console.log("❌ Status changed to FAIL (error detected)");
          }
        }
        // Update deployment status if received explicitly
        if (parsed.status) {
          setDeploymentStatus(parsed.status);
          console.log(`📊 Explicit status update from backend: ${parsed.status}`);
        }
        logContainerRef.current?.scrollIntoView({ behavior: "smooth" });
      } catch (e) {
        console.error("Error parsing Socket.io message:", e, "Raw:", message);
      }
    });

    socket.on("error", (error: any) => {
      console.error("Socket.io error:", error);
    });

    return () => {
      if (logPollingIntervalRef.current) {
        clearInterval(logPollingIntervalRef.current);
      }
    };
  }, []);

  // Load projects on mount
  useEffect(() => {
    const loadProjects = async () => {
      setLoading(true);
      const data = await fetchProjects();
      setProjects(data);
      setLoading(false);
    };
    loadProjects();
  }, [fetchProjects]);

  // Handle project creation
  const handleCreateProject = useCallback(async () => {
    if (!newProjectName.trim() || !newProjectGitURL.trim()) {
      alert("Please fill in all fields");
      return;
    }

    try {
      setLoading(true);
      const newProject = await apiCreateProject(newProjectName, newProjectGitURL);
      if (newProject) {
        setNewProjectName("");
        setNewProjectGitURL("");
        setShowNewProjectForm(false);
        const updated = await fetchProjects();
        setProjects(updated);
      }
    } catch (error) {
      console.error("Error creating project:", error);
      alert("Failed to create project");
    } finally {
      setLoading(false);
    }
  }, [newProjectName, newProjectGitURL, apiCreateProject, fetchProjects]);

  // Handle deployment
  const handleDeploy = useCallback(
    async (projectId: string) => {
      try {
        // Set loading for this specific project
        setDeployLoadingMap((prev) => ({ ...prev, [projectId]: true }));
        
        const deploymentId = await apiDeployProject(projectId);

        if (deploymentId) {
          // Get fresh project data
          const projectData = await fetchProject(projectId);
          
          // Set current deployment
          setCurrentDeployment({
            projectId,
            deploymentId,
            project: projectData,
          });

          // Clear previous logs
          setLogs([
            {
              log: `🚀 Deployment started: ${deploymentId}`,
              type: "status",
              timestamp: new Date().toLocaleTimeString(),
            },
          ]);

          setDeploymentStatus("QUEUED");

          // Subscribe to Socket.io (primary method for real-time logs from Kafka)
          socket.emit("subscribe", deploymentId);
          console.log(`📡 Subscribed to deployment: ${deploymentId}`);

          // Reset log count
          logCountRef.current = 1; // We already have the initial log

          // Start polling logs as fallback (only fills gaps if Socket.io disconnects)
          if (logPollingIntervalRef.current) {
            clearInterval(logPollingIntervalRef.current);
          }

          logPollingIntervalRef.current = setInterval(async () => {
            try {
              const logsData = await fetchLogs(deploymentId);
              if (logsData && logsData.length > logCountRef.current) {
                // We have new logs from ClickHouse that we haven't shown yet
                // This means Socket.io missed some, so append the new ones
                const newLogs = logsData.slice(logCountRef.current);
                console.log(`📡 Polling: Got ${newLogs.length} new logs from ClickHouse (had ${logCountRef.current})`);
                
                setLogs((prev) => [
                  ...prev,
                  ...newLogs.map((log: any) => ({
                    log: log.log || String(log),
                    type: "log",
                    timestamp: new Date().toLocaleTimeString(),
                  })),
                ]);
                logCountRef.current = logsData.length;
              }
            } catch (error) {
              console.error("❌ Error fetching logs from ClickHouse:", error);
            }
          }, 2000); // Poll every 2 seconds as fallback

          // Stop polling after 10 minutes (deployment should be done by then)
          setTimeout(() => {
            if (logPollingIntervalRef.current) {
              clearInterval(logPollingIntervalRef.current);
              logPollingIntervalRef.current = null;
              console.log("✅ Stopped polling logs (timeout reached)");
            }
          }, 600000);

          // Refresh projects list
          const updated = await fetchProjects();
          setProjects(updated);
        }
      } catch (error) {
        console.error("Error deploying project:", error);
        alert("Failed to deploy project");
      } finally {
        setDeployLoadingMap((prev) => ({ ...prev, [projectId]: false }));
      }
    },
    [apiDeployProject, fetchProject, fetchProjects, fetchLogs]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg">
                <Github className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white">Hosting Platform</h1>
            </div>
            <Button
              onClick={() => setShowNewProjectForm(!showNewProjectForm)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </div>
        </div>
      </div>

      {/* New Project Form */}
      {showNewProjectForm && (
        <div className="border-b border-slate-800 bg-slate-800/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="space-y-4">
              <Input
                placeholder="Project Name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                disabled={loading}
                className="bg-slate-800 border-slate-700 text-white placeholder-slate-400"
              />
              <Input
                placeholder="GitHub Repository URL"
                value={newProjectGitURL}
                onChange={(e) => setNewProjectGitURL(e.target.value)}
                disabled={loading}
                className="bg-slate-800 border-slate-700 text-white placeholder-slate-400"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleCreateProject}
                  disabled={loading}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Project"
                  )}
                </Button>
                <Button
                  onClick={() => setShowNewProjectForm(false)}
                  variant="outline"
                  disabled={loading}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && projects.length === 0 ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12">
            <Github className="w-16 h-16 mx-auto text-slate-600 mb-4" />
            <h2 className="text-2xl font-semibold text-slate-400 mb-2">No Projects Yet</h2>
            <p className="text-slate-500 mb-6">Create your first project to get started</p>
            <Button
              onClick={() => setShowNewProjectForm(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Project
            </Button>
          </div>
        ) : (
          <div className="grid gap-6">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                expanded={expandedProjects.has(project.id)}
                onToggle={(id) => {
                  setExpandedProjects((prev) => {
                    const newSet = new Set(prev);
                    if (newSet.has(id)) {
                      newSet.delete(id);
                    } else {
                      newSet.add(id);
                    }
                    return newSet;
                  });
                }}
                onDeploy={handleDeploy}
                onSelectDeployment={(project, deployment) => {
                  setCurrentDeployment({
                    projectId: project.id,
                    deploymentId: deployment.id,
                    project,
                  });
                  fetchLogs(deployment.id).then((data) => setLogs(data));
                  setDeploymentStatus(deployment.status);
                }}
                deployLoading={deployLoadingMap[project.id] || false}
                reverseProxyUrl={REVERSE_PROXY_URL}
              />
            ))}
          </div>
        )}
      </div>

      {/* Deployment Details Panel */}
      {currentDeployment && (
        <div className="fixed bottom-0 right-0 left-0 bg-slate-900 border-t border-slate-700 z-50 max-h-[70vh] flex flex-col">
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-slate-700 flex justify-between items-center flex-shrink-0">
              <div>
                <h4 className="text-sm font-semibold text-white">
                  🚀 {currentDeployment.project?.name}
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Deployment: {currentDeployment.deploymentId.substring(0, 8)}...
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setCurrentDeployment(null);
                  setLogs([]);
                  if (logPollingIntervalRef.current) {
                    clearInterval(logPollingIntervalRef.current);
                  }
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Deployment URL Section */}
            {currentDeployment.project && (
              <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex-shrink-0">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Deployment Status</p>
                    <div className="flex items-center gap-2">
                      {deploymentStatus === "READY" ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : (
                        <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                      )}
                      <span className="text-sm font-semibold text-white">
                        {deploymentStatus}
                      </span>
                    </div>
                  </div>

                  {(deploymentStatus === "READY" || deploymentStatus === "IN_PROGRESS") && (
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Live URL</p>
                      <div className="flex items-center gap-2 bg-slate-900 rounded px-3 py-2">
                        <code className="text-sm text-green-400 flex-1 truncate">
                          {getDisplayUrl(currentDeployment.project)}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const url = getProjectUrl(currentDeployment.project!);
                            navigator.clipboard.writeText(url);
                            alert("✅ URL copied!");
                          }}
                          className="h-6 w-6 p-0"
                        >
                          <Copy className="w-4 h-4 text-slate-400" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const url = getProjectUrl(currentDeployment.project!);
                            window.open(url, "_blank");
                          }}
                          className="h-6 w-6 p-0"
                        >
                          <ExternalLink className="w-4 h-4 text-slate-400" />
                        </Button>
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-xs text-slate-400 mb-1">S3 Artifacts</p>
                    <code className="text-xs text-yellow-400 bg-slate-900 p-2 rounded block truncate">
                      s3://newhosting-application/__outputs/{currentDeployment.projectId}/
                    </code>
                  </div>
                </div>
              </div>
            )}

            {/* Logs Section */}
            <div className="flex-1 overflow-auto">
              <div className={`${firaCode.className} text-xs text-green-400 p-4 bg-slate-950 h-full`}>
                <div className="flex flex-col gap-1">
                  {logs.length === 0 ? (
                    <code className="text-slate-500">Waiting for logs...</code>
                  ) : (
                    logs.map((entry, i) => (
                      <code
                        key={i}
                        ref={i === logs.length - 1 ? logContainerRef : undefined}
                        className={`${
                          entry.type === "status" ? "text-blue-400" : "text-green-400"
                        }`}
                      >
                        {`[${entry.timestamp}] ${entry.log}`}
                      </code>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
