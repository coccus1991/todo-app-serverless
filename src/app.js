const AWS = require("aws-sdk");
const {v4: uuidv4} = require('uuid');
const serverless = require('serverless-http');
const express = require("express");

const TASK_TABLE = process.env.TASK_TABLE;

let dynamoDBConf = {};

if (process.env.DYNAMODB_CLIENT_ENDPOINT)
    dynamoDBConf.endpoint = process.env.DYNAMODB_CLIENT_ENDPOINT;

if (process.env.DYNAMODB_CLIENT_REGION)
    dynamoDBConf.region = process.env.DYNAMODB_CLIENT_REGION

const dynamoDb = new AWS.DynamoDB.DocumentClient(dynamoDBConf);

const app = express();
const taskRouter = express.Router();

app.use(express.json());


const getUnixTime = () => ((Date.now() / 1000) | 0)

taskRouter.get("/task", async (req, res) => {
    const tasks = await dynamoDb.scan({
        TableName: TASK_TABLE
    }).promise();

    res.json(tasks.Items);
});

taskRouter.put("/task", async (req, res) => {
    const task = req.body;

    await dynamoDb.put({TableName: TASK_TABLE, Item: task}).promise();

    return res.json(task);
});

taskRouter.post("/task", async (req, res) => {
    let task = {
        ...req.body,
        id: uuidv4(),
        created_date: getUnixTime()
    };

    await dynamoDb.put({TableName: TASK_TABLE, Item: task}).promise();

    res.json(task);
});

taskRouter.delete("/task/:id", async (req, res) => {
    await dynamoDb.delete({
        TableName: TASK_TABLE, Key: {
            id: req.params.id
        }
    }).promise();

    res.status(200).send();
});

app.use(process.env.BASE_PATH || "/", taskRouter)


module.exports.lambdaHandler = serverless(app);
