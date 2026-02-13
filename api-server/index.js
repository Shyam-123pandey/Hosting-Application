const express = require("express");
const { generateSlug } = require("random-word-slugs");
const { ECSClient, RunTaskCommand } = require("@aws-sdk/client-ecs");
const { Server } = require("socket.io");
const cors = require("cors");
const { z } = require("zod");
const { PrismaClient } = require("@prisma/client");
const { createClient } = require("@clickhouse/client");
const { Kafka } = require("kafkajs");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const http = require("http");

const app = express();
const PORT = 9000;

const prisma = new PrismaClient({});

// Create HTTP server and attach Socket.io
const server = http.createServer(app);
const io = new Server(server, { 
  cors: { origin: "*", methods: ["GET", "POST"] }
});
const client = createClient({
  host: "https://avnadmin:AVNS_Qvpx47TYhJBWBXMp0hO@clickhouse-3e66640b-shyampandey2625-1429.j.aivencloud.com:11319",
  port: 11319,
  username: "avnadmin",
  password: "AVNS_Qvpx47TYhJBWBXMp0hO",
});

const kafka = new Kafka({
  clientId: `api-server`,
  brokers: ["kafka-278e95b5-shyampandey2625-1429.d.aivencloud.com:11331"],
  connectionTimeout: 10000,
  requestTimeout: 30000,
  ssl: {
    ca: [fs.readFileSync(path.join(__dirname, "ca.pem"), "utf-8")],
  },
  sasl: {
    username: "avnadmin",
    password: "AVNS_TVgmfSR1w7j7civJBPi",
    mechanism: "plain",
  },
});

const consumer = kafka.consumer({ groupId: "api-server-logs-consumer" });

// Socket.io connection handler
io.on("connection", (socket) => {
  console.log(`[Socket] User connected: ${socket.id}`);
  
  socket.on("subscribe", (deploymentId) => {
    socket.join(`deployment:${deploymentId}`);
    socket.emit("message", JSON.stringify({ 
      log: `Subscribed to deployment logs: ${deploymentId}`,
      type: "subscribe"
    }));
    console.log(`[Socket] User subscribed to deployment: ${deploymentId}`);
  });

  socket.on("disconnect", () => {
    console.log(`[Socket] User disconnected: ${socket.id}`);
  });
});

const ecsClient = new ECSClient({
  region: "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const config = {
  CLUSTER: "arn:aws:ecs:ap-south-1:149933880141:cluster/hosting-builder",
  TASK: "arn:aws:ecs:ap-south-1:149933880141:task-definition/builder-taskhosting",
};

app.use(express.json());
app.use(cors());

app.post("/project", async (req, res) => {
  const schema = z.object({
    name: z.string(),
    gitURL: z.string(),
  });
  const safeParseResult = schema.safeParse(req.body);

  if (safeParseResult.error)
    return res.status(400).json({ error: safeParseResult.error });

  const { name, gitURL } = safeParseResult.data;

  const project = await prisma.project.create({
    data: {
      id: uuidv4(),
      name,
      git_url: gitURL,
      subdomain: generateSlug(),
      updatedAt: new Date(),
      createdAt: new Date(),
    },
  });

  return res.json({ status: "success", data: { project } });
});

app.post("/deploy", async (req, res) => {
  const { projectId } = req.body;

  const project = await prisma.project.findUnique({ where: { id: projectId } });

  if (!project) return res.status(404).json({ error: "Project not found" });

  // Check if there is no running deployement
  const deployment = await prisma.deployement.create({
    data: {
      id: uuidv4(),
      status: "QUEUED",
      Project: {
        connect: { id: projectId },
      },
      updatedAt: new Date(),
    },
  });

  // Spin the container
  const command = new RunTaskCommand({
    cluster: config.CLUSTER,
    taskDefinition: config.TASK,
    launchType: "FARGATE",
    count: 1,
    networkConfiguration: {
      awsvpcConfiguration: {
        assignPublicIp: "ENABLED",
        subnets: [
          "subnet-044025e3226bb0195",
          "subnet-0c0207652dfedd5f9",
          "subnet-01595d94ea65d9e72",
        ],
        securityGroups: ["sg-065beb2606d54449d"],
      },
    },
    overrides: {
      containerOverrides: [
        {
          name: "hosting-task",
          environment: [
            { name: "GIT_REPOSITORY_URL", value: project.git_url },
            { name: "PROJECT_ID", value: projectId },
            { name: "DEPLOYMENT_ID", value: deployment.id },
          ],
        },
      ],
    },
  });

  await ecsClient.send(command);

  return res.json({ status: "queued", data: { deploymentId: deployment.id } });
});

// Get all projects
app.get("/projects", async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      include: {
        Deployement: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    return res.json({ status: "success", data: { projects } });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Get specific project with all deployments
app.get("/projects/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        Deployement: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    return res.json({ status: "success", data: { project } });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Get deployment details
app.get("/deployments/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deployment = await prisma.deployement.findUnique({
      where: { id },
      include: {
        Project: true,
      },
    });

    if (!deployment) {
      return res.status(404).json({ error: "Deployment not found" });
    }

    return res.json({ status: "success", data: { deployment } });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get("/logs/:id", async (req, res) => {
  const id = req.params.id;
  const logs = await client.query({
    query: `SELECT * from log_events where deployment_id = {deployment_id:String}`,
    query_params: {
      deployment_id: id,
    },
    format: "JSONEachRow",
  });

  const rawLogs = await logs.json();

  return res.json({ logs: rawLogs });
});

async function initkafkaConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topics: ["container-logs"], fromBeginning: true });

  await consumer.run({
    eachBatch: async function ({
      batch,
      heartbeat,
      commitOffsetsIfNecessary,
      resolveOffset,
    }) {
      const messages = batch.messages;
      console.log(`Recv. ${messages.length} messages..`);
      for (const message of messages) {
        if (!message.value) continue;
        const stringMessage = message.value.toString();
        const { PROJECT_ID, DEPLOYMENT_ID, log } = JSON.parse(stringMessage);
        if (!DEPLOYMENT_ID) {
          console.log("Missing DEPLOYMENT_ID in log message", {
            PROJECT_ID,
            log,
            raw: stringMessage,
          });
          continue;
        }
        console.log({ log, DEPLOYMENT_ID });
        try {
          // Insert log into ClickHouse
          const { query_id } = await client.insert({
            table: "log_events",
            values: [
              { event_id: uuidv4(), deployment_id: DEPLOYMENT_ID, log },
            ],
            format: "JSONEachRow",
          });
          console.log("📝 Inserted log into ClickHouse with query_id:", query_id);
          
          // Auto-detect and update deployment status based on log content
          const logLower = log.toLowerCase();
          if (logLower.includes("build started")) {
            await updateDeploymentStatus(DEPLOYMENT_ID, "IN_PROGRESS");
          } else if (logLower.includes("done") || logLower.includes("uploaded successfully")) {
            await updateDeploymentStatus(DEPLOYMENT_ID, "READY");
          } else if (logLower.includes("error") || logLower.includes("failed")) {
            await updateDeploymentStatus(DEPLOYMENT_ID, "FAIL");
          }
          
          // Broadcast log to subscribers via Socket.io
          io.to(`deployment:${DEPLOYMENT_ID}`).emit("message", JSON.stringify({
            log,
            type: "log",
            deploymentId: DEPLOYMENT_ID
          }));
          console.log(`📡 Broadcasted log to Socket.io room: deployment:${DEPLOYMENT_ID}`);
          
          resolveOffset(message.offset);
          await commitOffsetsIfNecessary(message.offset);
          await heartbeat();
        } catch (err) {
          console.log("❌ Error processing log:", err);
        }
      }
    },
  });
}

// Function to broadcast deployment status changes
async function updateDeploymentStatus(deploymentId, newStatus) {
  try {
    const deployment = await prisma.deployement.findUnique({
      where: { id: deploymentId },
    });

    if (!deployment) {
      console.log(`⚠️  Deployment ${deploymentId} not found`);
      return null;
    }

    // Prevent status from going backwards or staying the same
    const statusOrder = { "QUEUED": 0, "IN_PROGRESS": 1, "READY": 2, "FAIL": 3 };
    const currentStatusLevel = statusOrder[deployment.status] || -1;
    const newStatusLevel = statusOrder[newStatus] || -1;

    if (newStatusLevel <= currentStatusLevel && deployment.status !== "QUEUED") {
      console.log(`⏭️  Skipping status update: ${deployment.status} → ${newStatus} (backwards)`);
      return deployment;
    }

    if (deployment.status === newStatus) {
      console.log(`⏭️  Status already ${newStatus}, skipping update`);
      return deployment;
    }

    // Update in database
    const updated = await prisma.deployement.update({
      where: { id: deploymentId },
      data: { status: newStatus, updatedAt: new Date() },
      include: { Project: true }
    });
    
    // Broadcast status update to Socket.io
    io.to(`deployment:${deploymentId}`).emit("message", JSON.stringify({
      type: "status",
      status: newStatus,
      deploymentId,
      updatedAt: updated.updatedAt
    }));
    
    console.log(`🔄 Deployment ${deploymentId} status updated: ${deployment.status} → ${newStatus}`);
    return updated;
  } catch (error) {
    console.error(`❌ Error updating deployment status:`, error);
  }
}

initkafkaConsumer();

server.listen(PORT, () => console.log(`API Server Running on ${PORT}`));
