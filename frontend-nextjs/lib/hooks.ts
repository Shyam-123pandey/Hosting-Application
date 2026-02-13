import { useState, useCallback } from "react";
import axios from "axios";

const API_BASE_URL = "http://localhost:9000";

export interface Project {
  id: string;
  name: string;
  git_url: string;
  subdomain: string;
  custom_domain?: string;
  createdAt: string;
  updatedAt: string;
  Deployement: Deployment[];
}

export interface Deployment {
  id: string;
  project_id: string;
  status: "NOT_STARTED" | "QUEUED" | "IN_PROGRESS" | "READY" | "FAIL";
  createdAt: string;
  updatedAt: string;
}

export const useApi = () => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchProjects = useCallback(async (): Promise<Project[]> => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API_BASE_URL}/projects`);
      return data.data?.projects || [];
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProject = useCallback(
    async (projectId: string): Promise<Project | null> => {
      try {
        setLoading(true);
        const { data } = await axios.get(`${API_BASE_URL}/projects/${projectId}`);
        return data.data?.project || null;
      } catch (err: any) {
        setError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const fetchDeployment = useCallback(async (deploymentId: string) => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API_BASE_URL}/deployments/${deploymentId}`);
      return data.data?.deployment || null;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(
    async (
      deploymentId: string
    ): Promise<Array<{ log: string; type: string; timestamp: string }>> => {
      try {
        const { data } = await axios.get(`${API_BASE_URL}/logs/${deploymentId}`);
        return Array.isArray(data.logs)
          ? data.logs.map((log: any) => ({
              log: log.log || log,
              type: "log",
              timestamp: new Date().toISOString(),
            }))
          : [];
      } catch (err: any) {
        setError(err.message);
        return [];
      }
    },
    []
  );

  const createProject = useCallback(
    async (name: string, gitURL: string): Promise<Project | null> => {
      try {
        setLoading(true);
        const { data } = await axios.post(`${API_BASE_URL}/project`, {
          name,
          gitURL,
        });
        return data.data?.project || null;
      } catch (err: any) {
        setError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const deployProject = useCallback(async (projectId: string) => {
    try {
      setLoading(true);
      const { data } = await axios.post(`${API_BASE_URL}/deploy`, {
        projectId,
      });
      return data.data?.deploymentId || null;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    error,
    loading,
    fetchProjects,
    fetchProject,
    fetchDeployment,
    fetchLogs,
    createProject,
    deployProject,
  };
};
