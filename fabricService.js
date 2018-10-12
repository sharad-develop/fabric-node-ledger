'use strict';

var Fabric_Client = require('fabric-client');
var Fabric_CA_Client = require('fabric-ca-client');
var path = require('path');
var util = require('util');
var os = require('os');

var store_path = path.join(__dirname, 'hfc_key_store');

/**
 * Service class that interfaces with the ledgerCC chaincode deployed on
 * the hyperledger fabric n/w
 * 
 */
class FabricService {
constructor(id){

    this.MSP_ID = 'Org1MSP';  
    this.EVENT_HUB = 'grpc://localhost:7053';
    this.CHANNEL = 'mychannel';
    this.PEER_ADDR = 'grpc://localhost:7051';
    this.ORDERER_ADDR = 'grpc://localhost:7050';
    this.CHAINCODE_ID = 'ledgerCC';

    this.fabric_client = new Fabric_Client();
    this.fabric_ca_client = null;
    
    // setup the fabric network
    this.channel = this.fabric_client.newChannel(this.CHANNEL);
    this.peer = this.fabric_client.newPeer(this.PEER_ADDR);
    this.channel.addPeer(this.peer);
    this.orderer = this.fabric_client.newOrderer(this.ORDERER_ADDR);
    this.channel.addOrderer(this.orderer); 

    this.member_user = null;
    this.admin_user = null;
    this.store_path = path.join(__dirname, 'hfc_key_store');

    console.log('Store path:'+this.store_path);
    this.tx_id = null;


}

/**
 * Creates admin if not present otherwises just sets it into context.
 * For fun it returns the public key.
 * 
 * @param {*} username 
 * @param {*} password 
 */
getOrCreateAdmin(username, password){

    console.log("Enroll admin :"+username);

    return this._getUserContext(username, true).then((user_from_store)=>{
        
            if(user_from_store && user_from_store.isEnrolled()){
                console.log("User already enrolled");
                this.admin_user = user_from_store;
                return null;
            }else{
                return this.fabric_ca_client.enroll({
                    enrollmentID: username,
                    enrollmentSecret: password
                }).then((enrollment)=>{
        
                    console.log('Sucessfully enrolled user admin');
                    return this.fabric_client.createUser(
                        {username: username,
                            mspid: this.MSP_ID,
                            cryptoContent: { privateKeyPEM: enrollment.key.toBytes(), signedCertPEM: enrollment.certificate }
                        });
                    }).then((user)=>{
                            this.admin_user = user;
                            return this.fabric_client.setUserContext(this.admin_user);
                    }).catch((err) => {
                        console.error('Failed to enroll and persist admin. Error: ' + err.stack ? err.stack : err);
                        throw new Error('Failed to enroll admin');
                    });
                
            }
        }).then(() => {
            console.log('Assigned the admin user to the fabric client ::' + this.admin_user.toString());
            return this.admin_user.toString();

        }).catch((err) => {
            console.error('Failed to enroll admin: ' + err);
            return err;
    });
}

/**
 * Register user, will error out if user is already present
 * 
 * @param {*} username 
 */
registerUser(username){

   return this._getUserContext('admin', true).then((user_from_store) => {

    if(user_from_store && user_from_store.isEnrolled()){
        console.log("Sucessfully loaded admin from persistence");
        this.admin_user = user_from_store;
    }else{
        throw new Error("Admin user not found");
    }

    return this.fabric_ca_client.register({enrollmentID: username, affiliation: 'org1.department1'}, this.admin_user);
  

}).then((secret) => {

    console.log("Successfully registered :"+username+" with secret :"+secret);
    return this.fabric_ca_client.enroll({enrollmentID : username, enrollmentSecret : secret});

}).then((enrollment) => {
    console.log("Successfully enrolled :"+username);
    return this.fabric_client.createUser({
        username: username,
        mspid: this.MSP_ID,
        cryptoContent: { privateKeyPEM: enrollment.key.toBytes(), signedCertPEM: enrollment.certificate }
    });
}).then((user)=>{
    this.member_user = user;
    return this.fabric_client.setUserContext(this.member_user);
}).then(()=>{
    return 'User successfully enrolled';
    console.log(username+'was successfully registered and enrolled and is ready to intreact with the fabric network');

}).catch((err) => {

   console.error('Failed to register: ' + err);
   if(err.toString().indexOf('Authorization') > -1) {
       console.error('Authorization failures may be caused by having admin credentials from a previous CA instance.\n' +
       'Try again after deleting the contents of the store directory '+this.store_path);
   }


   return 'User enrollment failed , check logs'; 
});

}

/**
 * Adds a new account to the ledger
 * 
 * @param {*} username 
 * @param {*} fcnArgs 
 */
addAccount(username, fcnArgs){

    var req = {
        chaincodeId:this.CHAINCODE_ID,
        fcn: 'addAccount',
        args: fcnArgs,
        chainId: this.CHANNEL
    };

   return this._invokeCC(username, req);

}

/**
 * Transfers set amount from account A to B.
 * 
 * @param {*} username 
 * @param {*} fcnArgs 
 */
transfer(username, fcnArgs){
    
        var req = {
            chaincodeId:this.CHAINCODE_ID,
            fcn: 'transfer',
            args: fcnArgs,
            chainId: this.CHANNEL
        };
    
       return this._invokeCC(username, req);
    
    }

/**
 * Query chaincode db. Returns record matching the 'id' passed.
 * 
 */
query(username, queryArgs){
    
    return this._getUserContext(username)
    .then((user_from_store) => {
        
            if(user_from_store && user_from_store.isEnrolled()){
                console.log("successfully loaded user");
        
                this.member_user = user_from_store;
            }else{
                throw new Error('Failed to get :'+username+' run registerUser.js');
            }
        
            const req = {
                chaincodeId: this.CHAINCODE_ID,
                fcn:'query',
                args:queryArgs
            };
        
            return this.channel.queryByChaincode(req);
        
        }).then((query_responses) => {
            let results = "No results to show";
            
            if(query_responses && query_responses.length ==1){
        
                if(query_responses[0] instanceof Error){
                    console.log("Error from query", query_responses[0]);
                }else{
                    console.log("Results", query_responses[0].toString());
                    results = query_responses[0].toString();
                }
        
            }else{
                console.log("No payloads returned from query");
            }
    
            return results;
        }).catch((err) => {
            console.log("Failed to query successfully::"+err);
        });
    
    }
/**
 * This method invokes the chaincode deployed on the fabric server with the given args
 * 
 * @param {*} fcnArgs 
 */    
_invokeCC(username, req) {

    return this._getUserContext(username).then((user_from_store) => {
            if (user_from_store && user_from_store.isEnrolled()) {
                console.log('Successfully loaded:'+ username +' from persistence');
                this.member_user = user_from_store;
            } else {
                throw new Error('Failed to get '+username+' run registerUser.js');
            }

            this.tx_id = this.fabric_client.newTransactionID();
            console.log("Assigning transaction_id: ", this.tx_id._transaction_id);

            req.txId = this.tx_id;
            return this.channel.sendTransactionProposal(req);
    
        }
    
    ).then((results) => {
    
        var proposalResponses = results[0];
        var proposal = results[1];
        let isProposalGood = false;
        if (proposalResponses && proposalResponses[0].response &&
            proposalResponses[0].response.status === 200) {
                isProposalGood = true;
                console.log('Transaction proposal was good');
            } else {
                console.error('Transaction proposal was bad');
        }
    
        if (isProposalGood) {
            console.log(util.format(
                'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s"',
                proposalResponses[0].response.status, proposalResponses[0].response.message));
    
            var req = {
                proposalResponses: proposalResponses,
                proposal: proposal
            };
    
            var transaction_id_string = this.tx_id.getTransactionID();
    
            var promises = [];
            var sendPromise = this.channel.sendTransaction(req);
    
            promises.push(sendPromise);
    
            var event_hub = this.fabric_client.newEventHub();
            event_hub.setPeerAddr(this.EVENT_HUB);
    
            let txpromise = new Promise((resolve, reject) => {
    
                let handle = setTimeout(() =>{
                    event_hub.disconnect();
                    resolve({event_status: 'TIMEOUT'});
                } , 3000);
    
                event_hub.connect();
                event_hub.registerTxEvent(transaction_id_string, (tx, code) =>{
    
                    clearTimeout(handle);
                    event_hub.unregisterTxEvent(transaction_id_string);
                    event_hub.disconnect();
    
                    var return_status = { event_status: code, tx_id: transaction_id_string};
    
                    if(code != 'VALID'){
                        console.log("Transaction was invalid = "+code);
                        reject(new Error("Transaction was invalid"));
                    }else{
                        console.log('The transaction has been committed on peer ' + event_hub._ep._endpoint.addr);
                        resolve(return_status);
                    }
    
    
                }, (err) => {
                    //this is the callback if something goes wrong with the event registration or processing
                    reject(new Error('There was a problem with the eventhub ::'+err));
                    });
    
            });
    
            promises.push(txpromise);
    
            return Promise.all(promises);
        } else {
            console.error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
            throw new Error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
        }
    }).then((results) => {
        console.log('Send transaction promise and event listener promise have completed');
        // check the results in the order the promises were added to the promise all list
        if (results && results[0] && results[0].status === 'SUCCESS') {
            console.log('Successfully sent transaction to the orderer.');
        } else {
            console.error('Failed to order the transaction. Error code: ' + response.status);
        }
    
        if(results && results[1] && results[1].event_status === 'VALID') {
            console.log('Successfully committed the change to the ledger by the peer');
        } else {
            console.log('Transaction failed to be committed to the ledger due to ::'+results[1].event_status);
        }

        return results[1];
    }).catch((err) => {
        console.error('Failed to invoke successfully :: ' + err);
    });       
}

/**
 * Get user context from local key store
 * 
 * @param {*} username 
 * @param {*} isAdmin 
 */
_getUserContext(username, isAdmin){
  
    return Fabric_Client.newDefaultKeyValueStore({ path: store_path
    }).then((state_store) => {
        // assign the store to the fabric client
        this.fabric_client.setStateStore(state_store);
        var crypto_suite = Fabric_Client.newCryptoSuite();
        // use the same location for the state store (where the users' certificate are kept)
        // and the crypto store (where the users' keys are kept)
        var crypto_store = Fabric_Client.newCryptoKeyStore({path: store_path});
        crypto_suite.setCryptoKeyStore(crypto_store);
        this.fabric_client.setCryptoSuite(crypto_suite);

        if(isAdmin){
            var	tlsOptions = {
                trustedRoots: [],
                verify: false
        }; 

             this.fabric_ca_client = new Fabric_CA_Client('http://localhost:7054', tlsOptions, 'ca.example.com', crypto_suite);
          
        }
        // get the enrolled user from persistence, this user will sign all requests
        return  this.fabric_client.getUserContext(username, true);
    });

}
 
}

module.exports = FabricService;


