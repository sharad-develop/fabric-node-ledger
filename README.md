# Hyperledger Fabric Node SDK

This project exposes the hyperledger fabric blockchain ledger as a webservice.
It achieves this using node sdk provided by hyperledger. Also, chaincode(smart contract) for the application
is written using nodejs.

## Pre-req
Download fabcar at https://github.com/hyperledger/fabric-samples and run it on docker container.

## App details
The app creates a ledger blockchain db storing user and there balances. New users can be added.
And balance can  be transferred from one user to another.
Before invoking any chaincode requests, crypto material needs to be generated for the admin user.
The api right now only demonstrates generation of crypto material for Preregistered admin only.
All the crypto material will be written to hfc_key_store folder and accessed
for any subsequent requests.
That admin is admin/adminpw. Subsequent(smart contract) requests requires enrolling an user.

## Environment
I have used node v8.12.0 and fabric v1.2.

## Chaincode
### Deploy
####Terminal 1
cd /fabric-samples/fabcar
./startFabric.sh
docker logs -f peer0.org1.example.com

####Terminal2
cd /fabric-node-ledger
CORE_CHAINCODE_ID_NAME="ledgerCC:v1" node chaincode/ledgerCC.js --peer.address grpc://0.0.0.0:7052

####Terminal 3
docker exec -it cli bash 
CORE_PEER_LOCALMSPID=Org1MSP peer chaincode install -l node -n ledgerCC -p node-cc/ -v v1
CORE_PEER_LOCALMSPID=Org1MSP peer chaincode instantiate -l node -n ledgerCC -v v1 -C mychannel -c '{"args":["init"]}'

###Test
####Terminal 3
peer chaincode invoke -n ledgerCC -C mychannel -c '{"Args":["query","1"]}'
peer chaincode invoke -n ledgerCC -C mychannel -c '{"Args":["queryAll"]}'
peer chaincode invoke -n ledgerCC -C mychannel -c '{"Args":["addAccount","5","Sam","50"]}'
peer chaincode invoke -n ledgerCC -C mychannel -c '{"Args":["transfer","1","2","10"]}'

## Run
cd /fabric-node-ledger
node index.js

## Usage

Example requests:
### Enroll admin
http://localhost:3000/api/enroll/admin
{
	"username":"admin",
	"password":"adminpw"
}

### Register user
http://localhost:3000/api/enroll/user
{
	"username":"user1"
}


### Add account
http://localhost:3000/api/ledger/addaccount
{
	"username":"user1",
	"account":{
		"id":"7",
		"name":"Tim",
		"balance":"75"
		
	}
}

### Transfer balance
http://localhost:3000/api/ledger/transfer
{
	"username":"user1",
	"transfer":{
		"from":"1",
		"to":"2",
		"balance":"10"
		
	}
}

### Query
http://localhost:3000/api/ledger/query
{
	"username":"user8",
	"account":{
		"id":"1"
	}
}

For more detailed info visit hyperledger documentation.