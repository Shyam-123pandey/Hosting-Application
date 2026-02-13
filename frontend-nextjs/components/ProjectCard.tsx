import React from "react";
import {
  CheckCircle2,
  Loader2,
  Clock,
  AlertCircle,
  Zap,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Project, Deployment } from "@/lib/hooks";

interface DeploymentStatusBadgeProps {
  status: string;
}

export const DeploymentStatusBadge: React.FC<DeploymentStatusBadgeProps> = ({
  status,
}) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "READY":
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "IN_PROGRESS":
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case "QUEUED":
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case "FAIL":
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Zap className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "READY":
        return "bg-green-950 text-green-200";
      case "IN_PROGRESS":
        return "bg-blue-950 text-blue-200";
      case "QUEUED":
        return "bg-yellow-950 text-yellow-200";
      case "FAIL":
        return "bg-red-950 text-red-200";
      default:
        return "bg-gray-950 text-gray-200";
    }
  };

  return (
    <div className={`flex items-center gap-2 text-sm px-2 py-1 rounded ${getStatusColor(status)}`}>
      {getStatusIcon(status)}
      <span>{status}</span>
    </div>
  );
};

interface ProjectCardProps {
  project: Project;
  expanded: boolean;
  onToggle: (projectId: string) => void;
  onDeploy: (projectId: string) => void;
  onSelectDeployment: (project: Project, deployment: Deployment) => void;
  deployLoading: boolean;
  reverseProxyUrl: string;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  expanded,
  onToggle,
  onDeploy,
  onSelectDeployment,
  deployLoading,
  reverseProxyUrl,
}) => {
  const getProjectUrl = () => {
    const customDomain = project.custom_domain?.trim();
    if (customDomain) {
      if (customDomain.startsWith("http://") || customDomain.startsWith("https://")) {
        return customDomain;
      }
      return `https://${customDomain}`;
    }
    return `${reverseProxyUrl}/${project.id}`;
  };

  const displayProjectUrl = getProjectUrl().replace(/^https?:\/\//, "");

  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden bg-slate-800/50 hover:bg-slate-800/70 transition">
      {/* Project Header */}
      <div
        className="p-6 cursor-pointer"
        onClick={() => onToggle(project.id)}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-2">
              {project.name}
            </h3>
            <p className="text-slate-400 text-sm mb-3 truncate">
              {project.git_url}
            </p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <span>Live URL:</span>
                <code className="bg-slate-900 px-2 py-1 rounded">
                  {displayProjectUrl}
                </code>
              </div>
              {project.Deployement.length > 0 && (
                <DeploymentStatusBadge status={project.Deployement[0].status} />
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onDeploy(project.id);
              }}
              disabled={deployLoading}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              {deployLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Deploy
                </>
              )}
            </Button>
            {expanded ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </div>
        </div>
      </div>

      {/* Deployments */}
      {expanded && (
        <div className="border-t border-slate-700 px-6 py-4 space-y-3">
          <h4 className="text-sm font-semibold text-slate-300">Deployment History</h4>
          {project.Deployement.length === 0 ? (
            <p className="text-slate-500 text-sm">No deployments yet</p>
          ) : (
            <div className="space-y-2">
              {project.Deployement.map((deployment) => (
                <div
                  key={deployment.id}
                  className="p-3 rounded border border-slate-600 bg-slate-900/50 cursor-pointer hover:bg-slate-900/80 transition"
                  onClick={() => onSelectDeployment(project, deployment)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <DeploymentStatusBadge status={deployment.status} />
                        <span className="text-xs text-slate-500">
                          {new Date(deployment.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
