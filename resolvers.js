const gun = require('gun')(); // Initialize Gun instance
const twilio = require('twilio');
const crypto = require('crypto');

function generateRandomString(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let randomString = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    randomString += characters[randomIndex];
  }
  return randomString;
}

function createEncryptedKey(phoneNumber) {
  const randomString1 = generateRandomString(16);
  const randomString2 = generateRandomString(16);
  
  const dataToHash = phoneNumber + randomString1 + randomString2;

  const encryptedKey = crypto.createHash('sha256').update(dataToHash).digest('hex');
  return encryptedKey;
}

const sendMessage = async (body, phoneNumber, successMessage, failedMessage) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const client = twilio(accountSid, authToken);

  try {
    await client.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER || '',
      to: '+' + phoneNumber
    });
    
    console.log('Verification code sent successfully:', successMessage);
    return { message: 'Verification code sent to your phone number' };
  } catch (error) {
    console.error('Error sending verification code:', error);
    throw new Error(failedMessage);
  }
};

function generateUniqueMessageId(userId, roomId) {
  const timestamp = Date.now().toString();
  return `${userId}_${timestamp}_${roomId}`;
}

const resolvers = {
  Query: {
    user: async (_, { id }) => {
      // console.log("get user", id);
      const userNode = gun.get(id);
      const user = await userNode.then();
      return user;
    },
    users: async () => {
      return new Promise((resolve, reject) => {
        const allUsers = [];
        
        gun.get('users').map().on((data, key) => {
          // console.log("users", data);
          // console.log("soul+++++++++", key);
          if (data && data.phoneNumber) {
            allUsers.push({
              pub: key,
              phoneNumber: data.phoneNumber,
            });
          }
        });

        // Assuming 'once' here is a method provided by Gun.js
        gun.get('users').once(() => {
          resolve(allUsers);
        });
      });
    },
    getRoomMessages: async (_, { roomId }) => {    
      return new Promise((resolve, reject) => {
        console.log("getRoomMessages", roomId);
        const chatNode = gun.get('chat');
        const messagesNode = chatNode.get(roomId).get('messages');
        
        const messages = [];
        const processedMessageIds = new Set(); // Set to track processed messageIds
    
        messagesNode.map().on((messageData, messageKey) => {
          console.log("messagedata", messageData);
          
          // Check if messageId is already processed
          if (!processedMessageIds.has(messageKey) && messageData?.userId) {
            const message = {
              messageId: messageKey,
              roomId: roomId,
              userId: messageData.userId, 
              message: messageData.message, 
              timestamp: messageData.timestamp
            };  
    
            messages.push(message);
            processedMessageIds.add(messageKey); // Add messageId to processed set
          }
        });
     
        messagesNode.once(() => {
          messages.sort((a, b) => a.timestamp - b.timestamp);
          resolve(messages); 
        });
      });
    },    
    getAllChatMetadata: async (_, { userId }) => {
      return new Promise((resolve, reject) => {
        const allChatMetadata = [];
    
        gun.get('chatMetadata').map().on((data, roomId) => {
          const roomUserIds = roomId.split('_');
          if (roomUserIds.includes(userId) && data && data.lastMessage && !allChatMetadata.some(item => item.roomId === roomId)) {
            allChatMetadata.push({
              roomId: roomId,
              lastMessage: data.lastMessage,
              icon: 'Person',
              lastMessageTime: 'Now',
              messagesCounter: '32'
            });
          }
        }); 
    
        // You may need to use the 'once' method here based on Gun.js usage
        gun.get('chatMetadata').once(() => {
          resolve(allChatMetadata);
          console.log("allChatMetadata", allChatMetadata);
        });
      });
    }    
  },
  Mutation: {
    register: async (_, { phoneNumber }) => {
      // console.log("phoneNumber", phoneNumber);
      return new Promise(async (resolve, reject) => {
        const userNode = gun.get('users');
  
        try {
          // Generate OTP code
          const otp = Math.floor(1000 + Math.random() * 9000);
          console.log("otp", otp);
  
          userNode.get(phoneNumber).once((data, key) => {
            const encryptedKey = createEncryptedKey(phoneNumber);

            // console.log("data.............", !data);

            if (!data) {
              // User data doesn't exist, so create the user
              userNode.get(phoneNumber).put({ pub: encryptedKey, phoneNumber, otp, isReg: true });

              sendMessage(
                `Your verification code is: ${otp}`,
                phoneNumber,
                'Verification code sent successfully',
                'Failed to send verification code',
              )
                .then(() => {
                  resolve({ message: 'Verification code sent to your phone number', isReg: true });
                })
                .catch((error) => {
                  reject(new Error('Failed to send verification code'));
                });
            } else {
              // User data exists, so update the OTP
              userNode.get(phoneNumber).put({ pub: encryptedKey, otp });
          
              sendMessage(
                `Your verification code is: ${otp}`,
                phoneNumber,
                'Verification code sent successfully',
                'Failed to send verification code',
              )
                .then(() => {
                  resolve({ message: 'Verification code sent to your phone number', isReg: data?.isReg });
                })
                .catch((error) => {
                  reject(new Error('Failed to send verification code'));
                });
            }
          });
        } catch (error) {
          console.error('Error registering user:', error);
          reject(new Error('Failed to register user'));
        }
      });
    },
    verify: async (_, { userId, otp }) => {
      console.log("verify");
      return new Promise(async (resolve, reject) => {
        try {
          console.log("verify", userId, otp);
  
          const userNode = gun.get('users');
          // console.log("userNode", userNode);
          const data = await userNode.get(userId);
          console.log("data", data);
  
          if (data?.otp == otp) {
            userNode.get(userId).put({ otp: null });
            resolve({
              message: 'Successfully verified the account',
              payload: {
                public_key: data?.pub
              },
              success: true,
              status: 200
            });
          } else {
            resolve({
              success: false,
              payload: {
                public_key: null
              },
              message: "Invalid OTP code",
              status: 403
            });
          }
        } catch (error0) {
          reject({
            success: false,
            payload: {
              public_key: null
            },
            message: error0.message,
            status: 403
          });
        }
      });
    },
    emptyUserNode: async () => {
      return new Promise(async (resolve, reject) => {
        try {
          const userNode = gun.get('users');
          // const chatNode = gun.get('chat');
          // const metaNode = gun.get('chatMetadata');
          // chatNode.delete;
          // metaNode.delete;

          userNode.map().once((userData, key) => {
            userNode.get(key).put(null); // Remove the user entry
          });

          resolve({
            message: 'User node emptied successfully',
            success: true,
            status: 200
          });
        } catch (error) {
          reject({
            success: false,
            message: 'Failed to empty user node',
            status: 500
          });
        }
      });
    },
    sendMessage: async (_, { roomId, message, userId }) => {
      console.log("send message mutation", roomId, message, userId);
      return new Promise(async (resolve, reject) => {
        try {
          const chatNode = gun.get('chat');
          
          // Assuming you have a unique key for each message (messageId)
          const messageId = generateUniqueMessageId(userId, roomId); // Replace with your logic to generate messageId
    

          const date = new Date(Date.now());
          const humanReadableDate = date.toLocaleDateString(); // Get the date in a human-readable format
          const humanReadableTime = date.toLocaleTimeString(); // Get the time in a human-readable format

          const humanReadableDateTime = `${humanReadableDate} ${humanReadableTime}`;

          // Construct the message object
          const messageObject = {
            roomId,
            messageId,
            userId,
            message,
            timestamp: Date.now()
          };
    
          // Save the message data to the chat node
          chatNode.get(roomId).get('messages').get(messageId).put(messageObject);

          // Update the chat metadata with the last message
          const chatMetadataNode = gun.get('chatMetadata').get(roomId);
          chatMetadataNode.put({ lastMessage: message });

          // console.log("messageObject", messageObject);

          io.emit('newMessage', messageObject);

          io.emit('newChat', { roomId, lastMessage: messageObject.message, lastMessageTime: humanReadableDateTime, messagesCounter: "32", icon: "Person" });
    
          // Resolve with success message or other data
          resolve(messageObject);
        } catch (error) {
          console.log("send message error", error);
          // Reject with error message
          reject({ success: false, message: 'Failed to send message' });
        }
      });
    },  
    updateProfile: async (_, args) => {
      const { firstName, lastName, dateOfBirth, phone, pin } = args;
      
      try {
        // Find the user based on the phone number
        const userNode = gun.get('users');
        userNode.get(phone).put({ firstName, lastName, dateOfBirth, pin, isReg: false });

        return {
          message: 'Profile updated successfully',
          success: true
        };
      } catch (error) {
        console.error('Error updating profile:', error);
        return {
          message: 'An error occurred while updating profile',
          success: false
        };
      }
    }    
  },
};

module.exports = resolvers;
