require('dotenv').config({ path: './.env' });

const express = require('express');
const { Server: SocketServer } = require('socket.io');
const http = require('http');
const cors = require('cors');
const config = require('./config');
const gunMiddleware = require('./middleware/gunMiddleware');
const cloudinary = require('./middleware/cloudinary');
const Gun = require('gun');
const { graphqlHTTP } = require('express-graphql');
const { makeExecutableSchema } = require('graphql-tools');
const typeDefs = require('./schema.graphql');
const resolvers = require('./resolvers');
const tweedService = require("./tweed.service");
const nftService = require("./nft.service");
const authService = require("./auth.service");

const app = express();

const main = async () => {
  const tweedClient = await tweedService.initialize();
  app.post("/message", async (req, res) => {
    console.log("=======")
    const authenticatedUser = authService.getAuthUser();
    const answer = await tweedClient.handleMessageFromFrontend(
      req.body.message,
      authenticatedUser.id,
      authenticatedUser.email
    );
    res.send({ answer });
  });
  app.post("/blockchain-id", (req, res) => {
    const { blockchainId } = req.body;
    nftService._setBlockchainId(blockchainId);
  });

  app.get("/user", async (req, res) => {
    const authUser = authService.getAuthUser();
    console.log(authUser)
    res.send({authUser});
  });

  app.post("/user", async (req, res) => {
    const id = req.body.id;
    const email = req.body.email;
    const updatedUser = authService.updateUser({ id, email });
    res.send(updatedUser);
  });
}

main();
const schema = makeExecutableSchema({ typeDefs, resolvers });

app.use('/graphql', graphqlHTTP({
  schema,
  graphiql: true,
}));


app.use(Gun.serve);

app.use(gunMiddleware);

// Gun('http://your-ec2-instance-ip:8765/database-name', { web: server });


app.use(cors(config.cors));
app.use(express.json({ limit: '10mb' }));
app.use(
  express.urlencoded({
    limit: '10mb',
    parameterLimit: 100000,
    extended: false,
  })
);

cloudinary();

const server = http.createServer(app);

Gun({ web: server });

// store socket on global object
io = new SocketServer(server, { cors: config.cors, perMessageDeflate: false });

let connectedClients = 0;
io.on('connection', (socket) => {
  connectedClients++;
  console.log(`A client connected. Total connected clients: ${connectedClients}`);

  socket.on('disconnect', () => {
    connectedClients--;
    console.log(`A client disconnected. Total connected clients: ${connectedClients}`);
  });
});

global.io = io;

module.exports = { io, server }; 
