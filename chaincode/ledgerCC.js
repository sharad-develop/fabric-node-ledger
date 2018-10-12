const shim = require('fabric-shim');
const util = require('util');

/**
 * Hyperledger chaincode class implementation.
 * This acts a account ledger with properties -id, name and balance.
 * Functions are exposed to add account, transfer and query the ledger.
 */
let Ledger = class {

    /**
     * Initialise the ledger.
     * This method needs to be called before any operations on the ledger can start. 
     * 
     * @param {*} stub 
     */
    async Init(stub) {
        console.info('=========== Instantiated fabcar chaincode ===========');

        try {
            //Ledger should be initialized separately instead of this methid call.
            //Doing it here for brevity
            await this.initLedger(stub);
            return shim.success(Buffer.from("success"));
        } catch (e) {
            return shim.error(e);
        }
    }

    /**
     * This method is the controlling point for any chaincode invocation.
     * 
     */
    async Invoke(stub) {
        
        let ret = stub.getFunctionAndParameters();
        console.info(ret);
    
        let method = this[ret.fcn];
        if (!method) {
            console.error('no function of name:' + ret.fcn + ' found');
            throw new Error('Received unknown function ' + ret.fcn + ' invocation');
        }
        try {
            let payload = await method(stub, ret.params);
            return shim.success(payload);
        } catch (err) {
            console.log(err);
            return shim.error(err);
        }
        
        
    }


    /**
     * This method iniaitizes the ledger with some data
     * 
     * @param {*} stub 
     */
    async initLedger(stub) {
        console.info('============= START : Initialize Ledger ===========');
        let accounts = [];
        accounts.push({
            id:'1',
            name:'Jim',
            balance:'100'
            });
        accounts.push({
            id:'2',
            name:'Moly',
            balance:'100'
            });
        accounts.push({
            id:'3',
            name:'Poly',
            balance:'100'
        });
        accounts.push({
            id:'4',
            name:'George',
            balance:'100'
        });
    
        for (let i = 0; i < accounts.length; i++) {
          await stub.putState(accounts[i].id, Buffer.from(JSON.stringify(accounts[i])));
          console.info('Added <--> ', accounts[i]);
        }
        console.info('============= END : Initialize Ledger ===========');
      }

    /**
     * Add new account to the ledger
     * 
     * @param {*} stub 
     * @param {*} args 
     */
    async addAccount(stub, args) {
        console.info('============= START : Add account ===========');
        if (args.length != 3) {
          throw new Error('Incorrect number of arguments. Expecting 3');
        }
    
        var account = {
          id: args[0],
          name: args[1],
          balance: args[2],
        };
    
        await stub.putState(args[0], Buffer.from(JSON.stringify(account)));
        console.info('============= END : Add account ===========');
      }

      /**
       * Transfer balance from one account to another
       * 
       * @param {*} stub 
       * @param {*} args 
       */
      async transfer(stub, args) {
        console.info('============= START : Transfer ===========');
        if (args.length != 3) {
          throw new Error('Incorrect number of arguments. Expecting 3');
        }
    
        let account1AsBytes = await stub.getState(args[0]);
        let account2AsBytes = await stub.getState(args[1]);
        let amount = parseInt(args[2]);

        let account1 = JSON.parse(account1AsBytes);
        let account2 = JSON.parse(account2AsBytes);

        //verify if the account has enough balance
        if(account1.balance > amount){
            console.info('============= Transfer balance:'+amount+' from:'+ account1.id +' to:'+account2.id+'===========');
            account1.balance = parseInt(account1.balance) - amount;
            account2.balance = parseInt(account2.balance) + amount;
        }else{
            throw new Error("Account doesn't have enough balance");

        }
    
        await stub.putState(account1.id, Buffer.from(JSON.stringify(account1)));
        await stub.putState(account2.id, Buffer.from(JSON.stringify(account2)));
        console.info('============= END : Transfer ===========');
      }
    
      /**
       * Function to help query ledger given the arguments
       * 
       * @param {*} stub 
       * @param {*} args 
       */
      async query(stub, args) {
        if (args.length != 1) {
          throw new Error('Incorrect number of arguments. Expecting account id: ex 1');
        }
        let accountId = args[0];
    
        let accountAsBytes = await stub.getState(accountId); 
        if (!accountAsBytes || accountAsBytes.toString().length <= 0) {
          throw new Error(accountId + ' does not exist: ');
        }
        console.log(accountAsBytes.toString());
        return accountAsBytes;
      }


    /**
     * Function that returns all the ledger data. 'SELECT * :)'
     * @param {*} stub 
     * @param {*} args 
     */  
    async queryAll(stub, args) {
    
        let startKey = '1';
        let endKey = '99999';
    
        let iterator = await stub.getStateByRange(startKey, endKey);
    
        let allResults = [];
        while (true) {
            let res = await iterator.next();
    
            if (res.value && res.value.value.toString()) {
            let jsonRes = {};
            console.log(res.value.value.toString('utf8'));
    
            jsonRes.Key = res.value.key;
            try {
                jsonRes.Record = JSON.parse(res.value.value.toString('utf8'));
            } catch (err) {
                console.log(err);
                jsonRes.Record = res.value.value.toString('utf8');
            }
            allResults.push(jsonRes);
            }
            if (res.done) {
            console.log('end of data');
            await iterator.close();
            console.info(allResults);
            return Buffer.from(JSON.stringify(allResults));
            }
        }
    }


}

shim.start(new Ledger());