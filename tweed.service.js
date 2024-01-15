const { TweedBackendSDK } = require("@paytweed/backend-sdk");
const nftService = require("./nft.service");

class TweedService {
  async initialize() {
    this._client = await TweedBackendSDK.setup({
      apiKey: process.env.TWEED_API_KEY,
      apiSecret: process.env.TWEED_API_SECRET,
      defaultBlockchainIds: ["ethereumSepolia"],
      callbacks: {
        getNftPurchaseData: async ({ nftId }) => nftService.getById(nftId),
      },
    });
    return this._client;
  }
}

module.exports = new TweedService();
