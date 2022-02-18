'use strict';

const chai = require('chai');

const AWS = require('aws-sdk');
const expect = chai.expect;
chai.use(require('chai-like'));
chai.use(require('chai-things'));

const {GenericContainer} = require("testcontainers");
const paramsTable = require('../configs/task-schema.json');
const apigwEvent = require("../configs/event-apigw.json");

describe('Tests task endpoint crud', function () {
    this.timeout(10000);

    let container;
    let app;

    let task = {
        name: "First task",
        description: "test task",
        completed: false
    };

    before(async () => {
        container = await new GenericContainer("amazon/dynamodb-local")
            .withExposedPorts(8000)
            .start()

        const dynamoDBConf = {
            region: "eu-central-1",
            endpoint: `http://${container.getHost()}:${container.getMappedPort(8000)}`
        };

        const dynamoClient = new AWS.DynamoDB(dynamoDBConf)
        await dynamoClient.createTable(paramsTable).promise()

        process.env.DYNAMODB_CLIENT_ENDPOINT = dynamoDBConf.endpoint;
        process.env.DYNAMODB_CLIENT_REGION = dynamoDBConf.region;
        process.env.TASK_TABLE = paramsTable.TableName;

        app = require('../../app.js');
    })

    it('POST /task', async () => {
        const event = {
            ...apigwEvent,
            path: "/task",
            httpMethod: "POST",
            body: JSON.stringify(task),
            headers: {...apigwEvent.headers, "Content-Type": "application/json"},
        };

        const response = await app.lambdaHandler(event);
        const data = JSON.parse(response.body);

        expect(response.statusCode).to.be.eq(200);

        expect(data).include(task)
            .and.have.property("id").that.is.a("string")
        // .and.have.property("created_at").that.a("number")

        task = data;
    });

    it('GET /task', async () => {
        const event = {...apigwEvent, path: "/task", httpMethod: "GET"};
        const response = await app.lambdaHandler(event);
        const data = JSON.parse(response.body);

        expect(data).an("array")
            .and.to.have.lengthOf(1)
            .and.to.have.deep.property("0").which.eq(task)
    });

    it('PUT /task', async () => {
        task.completed = true;

        const event = {
            ...apigwEvent,
            path: "/task",
            httpMethod: "PUT",
            body: JSON.stringify(task),
            headers: {...apigwEvent.headers, "Content-Type": "application/json"},
        };

        const response = await app.lambdaHandler(event);
        const data = JSON.parse(response.body);

        expect(response.statusCode).to.be.eq(200);

        expect(data).to.be.contain(task);
    });

    it('DELETE /task', async () => {
        const event = {
            ...apigwEvent,
            path: "/task/" + task.id,
            httpMethod: "DELETE",
            body: "",
            headers: {...apigwEvent.headers, "Content-Type": "application/json"},
        };

        const response = await app.lambdaHandler(event);

        expect(response.statusCode).to.be.eq(200);
    });

    after(async () => {
        await container.stop();
    })
});
