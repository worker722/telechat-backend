const { TweedBackendSDK, Environment } = require("@paytweed/backend-sdk");
const nftService = require("./nft.service");
const tokenService = require("./token.service");

class TweedService {
  async initialize() {
    this._client = await TweedBackendSDK.setup({
      apiKey: "ueJ5LRh1tT78oE2QeDTdZc23YOcRP3Bb",
      apiSecret: "d47Dvo_3zChcuzcaWSBp5l9UQfOPHRNHIUXqrhN7cFP2I5cST8xbAaUjtFX0g4RC",
      defaultBlockchainIds: ["ethereumSepolia"],
      callbacks: {
        getNftPurchaseData: async ({ nftId }) => nftService.getById(nftId),
        getTokenPurchaseData: async ({ tokenId }) =>
          tokenService.getById(tokenId),
      },
    });
    return this._client;
  }
}

module.exports = new TweedService();
