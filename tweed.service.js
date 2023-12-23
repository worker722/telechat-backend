const { TweedBackendSDK, Environment } = require("@paytweed/backend-sdk");
const nftService = require("./nft.service");
const tokenService = require("./token.service");

class TweedService {
  async initialize() {
    this._client = await TweedBackendSDK.setup({
      apiKey: "53dZfglDINWyAWdwtl9Bu279jEfb3V5F",
      apiSecret: "0SYSWuLAf8cCFTwav56uyE4R2ghyej2kH6FtB-v6_j-QKYRm8r2b8aX9QGRQzMiJ",
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
