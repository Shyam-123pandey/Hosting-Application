const express = require("express");
const { generateSlug } = require("random-word-slugs");
const { ECSClient, RunTaskCommand } = require("@aws-sdk/client-ecs");
const { Server } = require("socket.io");
const Redis = require("ioredis");
const { z } = require("zod");
const app = express();
const PORT = 9000;
const { PrismaClient } = require("@prisma/client");
// const { createClient} = require("@clickhouse/client")

const subscriber = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
const prisma = new PrismaClient({});

const io = new Server({ cors: "*" });

io.on("connection", (socket) => {
  socket.on("subscribe", (channel) => {
    socket.join(channel);
    socket.emit("message", `Joined ${channel}`);
  });
});

io.listen(9002, () => console.log("Socket Server 9002"));

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

app.post("/project", async (req, res) => {
  const schema = z.object({
    gitURL: z.string(),
    name: z.string(),
  });

  const parseResult = schema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.errors });
  }

  const { gitURL, name } = parseResult.data;
  const slug = generateSlug(3);
  const project = await prisma.project.create({
    data: {
      name,
      gitURL,
      subDomain: slug,
    },
  });

  return res.json({
    status: "success",
    data: {
      project,
    },
  });
});

app.post("/deploy", async (req, res) => {
  // const { gitURL, slug } = req.body
  // const projectSlug = slug ? slug : generateSlug()

  const { projectId } = req.body;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return res.json({
      status: "error",
      message: "Project not found",
    });
  }
  // check if no deployment is in progress or running
  const projectSlug = project.subDomain;
  const existingDeployment = await prisma.deployment.findFirst({  // findFirst returns first match
    where: {
      projectId: project.id,
      status: {
        in: ["QUEUED", "IN_PROGRESS"],
      },
    },
  });

  if (existingDeployment) {
    return res.status(400).json({
      status: "error",
      message: "Deployment already in progress",
    });
  }

  const deployment = await prisma.deployment.create({
    data: {
      projectId: project.id,
      status: "QUEUED",
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
          name: "hosting-task", // MUST match task definition
          environment: [
            { name: "GIT_REPOSITORY_URL", value: project.gitURL },
            { name: "PROJECT_ID", value: projectId },
            { name: "DEPLOYMENT_ID", value: deployment.id }
          ],
        },
      ],
    },
  });

  await ecsClient.send(command);

  return res.json({
    status: "queued",
    data: { projectSlug, url: `http://${projectSlug}.localhost:8000` },
  });
});

async function initRedisSubscribe() {
  console.log("Subscribed to logs....");
  subscriber.psubscribe("logs:*");
  subscriber.on("pmessage", (pattern, channel, message) => {
    io.to(channel).emit("message", message);
  });
}

initRedisSubscribe();

app.listen(PORT, () => console.log(`API Server Running..${PORT}`));

// const express = require('express')
// const http = require('http')
// const { Server } = require('socket.io')
// const Redis = require('ioredis')
// const { ECSClient, RunTaskCommand } = require('@aws-sdk/client-ecs')

// const app = express()
// const io = new Server({cors: '*'})

// const subscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

// io.on('connection', socket => {
//   console.log('Client connected:', socket.id)

//   socket.on('subscribe', channel => {
//     socket.join(channel)
//     socket.emit('message', `Joined ${channel}`)
//   })

//   socket.on('disconnect', () => {
//     console.log('Client disconnected:', socket.id)
//   })
// })

// io.listen(9001, () => {
//   console.log('Socket.io server running on port 9001')
// })

// const ecsClient = new ECSClient({ region: 'ap-south-1' ,
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//   }
// })

//  const config = {
//   CLUSTER: 'arn:aws:ecs:ap-south-1:149933880141:cluster/hosting-builder',
//   TASK: 'arn:aws:ecs:ap-south-1:149933880141:task-definition/builder-taskhosting',
// }

// app.use(express.json())

// app.post("/project", async (req, res) => {
//   try {
//     const gitURL = req.body.gitURL;
//     const slug = req.body.slug;

//     if (!gitURL) {
//       return res.status(400).json({ error: "gitURL is required" });
//     }

//     const projectslug = String(slug || "default")
//       .toLowerCase()
//       .replace(/[^a-z0-9-_]/g, "-");

//     const command = new RunTaskCommand({
//       cluster: config.CLUSTER,
//       taskDefinition: config.TASK,
//       launchType: "FARGATE",
//       count: 1,

//        tags: [],

//       networkConfiguration: {
//         awsvpcConfiguration: {
//           assignPublicIp: "ENABLED",
//           subnets: [
//             "subnet-044025e3226bb0195",
//             "subnet-0c0207652dfedd5f9",
//             "subnet-01595d94ea65d9e72"
//           ],
//           securityGroups: ["sg-065beb2606d54449d"]
//         }
//       },
//       overrides: {
//         containerOverrides: [
//           {
//             name: "hosting-task", // MUST match task definition
//             environment: [
//               {
//                 name: "GIT_REPOSITORY_URL",
//                 value: gitURL
//               },
//               {
//                 name: "PROJECT_ID",
//                 value: projectslug
//               }
//             ]
//           }
//         ]
//       }
//     });

//     await ecsClient.send(command);

//     res.json({ status: "queued", projectslug, "url": `https://${projectslug}.localhost:8000` });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: err.message });
//   }
// });

// async function initRedisSubscribe() {
//   console.log('Subscribed to Redis logs:*')
//   await subscriber.psubscribe('logs:*') // Subscribe to all channels matching 'logs:*' psubscribe means pattern subscribe

// subscriber.on('pmessage', (pattern, channel, message) => {
//    console.log('Redis log:', channel, message, pattern)
//   io.to(channel).emit('message', message)
// })

// }

// initRedisSubscribe()

// app.listen(9002, () => {
//   console.log(' server running on port 9002')
// })
