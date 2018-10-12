const express = require('express');
const router = express.Router();
const FabricService = require('../fabricService')

const fabricService = new FabricService(1);

router.post("/enroll/admin", (req,res) => {
    
    console.log("body", req.body);
    
    fabricService.getOrCreateAdmin(req.body.username, req.body.password)
    .then((results) => {
        res.send(results);
    });
    
  });

router.post("/enroll/user", (req,res) => {
    
    console.log("body", req.body);
    fabricService.registerUser(req.body.username)
    .then((results) => {
        res.send(results);
    });

    
});

router.post("/ledger/addaccount", (req,res) => {

    console.log("body", req.body);
    
    let args = [req.body.account.id, req.body.account.name, req.body.account.balance]; 

      fabricService.addAccount(req.body.username, args)
      .then((results) => {
            res.send(results);
      });

});

router.post("/ledger/transfer", (req,res) => {
    
        console.log("body", req.body);
        
        let args = [req.body.transfer.from, req.body.transfer.to, req.body.transfer.balance];

            fabricService.transfer(req.body.username, args)
            .then((results) => {
                res.send(results);
            });
    
    });

router.post("/ledger/query", (req,res) => {

    console.log("body", req.body);
    
    let args = [req.body.account.id]; 

    fabricService.query(req.body.username, args).then((results) => {
        res.send(results);
    });

});

module.exports = router;