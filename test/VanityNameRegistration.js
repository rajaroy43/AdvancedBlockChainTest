const { ethers } = require("hardhat");
const { use, expect } = require("chai");
const utils = ethers.utils
const { solidity } = require("ethereum-waffle");
use(solidity);

describe("Vanity Name Registration Contract", function () {
  
  let vanityNameRegistration,domainName,domainNameHash,account1,account2,value,secret,commitment;
  const secretWord = "mysecretword";

  beforeEach(async()=>{
    const VanityNameRegistrationContract = await ethers.getContractFactory("VanityNameRegistration");
    vanityNameRegistration = await VanityNameRegistrationContract.deploy();
    const accounts = await ethers.getSigners()
    account1 = accounts[0]
    account2 = accounts[1]
    domainName = "abhishek.eth";
    domainNameHash = utils.keccak256(utils.toUtf8Bytes(domainName))
    value = utils.parseUnits((domainName.length+1).toString(), 18);
    secret = utils.keccak256(utils.toUtf8Bytes(secretWord))
    commitment = await vanityNameRegistration.getCommitment(domainName,account1.address,secret)
  })

  it("Should able to registered new domain name", async function () {

      await expect(vanityNameRegistration.commit(commitment))
      .emit(vanityNameRegistration,"Commited")
      .withArgs(account1.address,commitment)
      await expect(vanityNameRegistration.registerDomain(domainName,secret,{value:value}))
      .emit(vanityNameRegistration,"DomainRegistered")
      .withArgs(account1.address,domainNameHash,value)
  });

  it("Should not able to registered new domain name without commitment", async function () {

    await expect(vanityNameRegistration.registerDomain(domainName,secret,{value:value}))
    .to.be.revertedWith("User don't commited thier secret yet")
  });

  it("Should not able to registered  domain again", async function () {

    await expect(vanityNameRegistration.commit(commitment))
    .emit(vanityNameRegistration,"Commited")
    .withArgs(account1.address,commitment)
    await expect(vanityNameRegistration.registerDomain(domainName,secret,{value:value}))
    .emit(vanityNameRegistration,"DomainRegistered")
    .withArgs(account1.address,domainNameHash,value)
    await expect(vanityNameRegistration.registerDomain(domainName,secret,{value:value}))
    .to.be.revertedWith("Already registered")
  });

  it("Should not able to registered domain if commitment time over", async function () {

    const oneDay = 86400 //in seconds

    await expect(vanityNameRegistration.commit(commitment))
    .emit(vanityNameRegistration,"Commited")
    .withArgs(account1.address,commitment)

    await ethers.provider.send("evm_increaseTime", [oneDay]);
    await ethers.provider.send("evm_mine");

    await expect(vanityNameRegistration.registerDomain(domainName,secret,{value:value}))
    .to.be.revertedWith("commitment time over")
  });

  it("Should not  able to commitment any secret if previous commitment is in progress with same secret", async function () {
 
    await vanityNameRegistration.commit(commitment)
    await expect(vanityNameRegistration.commit(commitment))
    .to.be.revertedWith("commitment is in progress")
  });

  describe('After registering domain', async() => {
    beforeEach(async()=>{
      await vanityNameRegistration.commit(commitment)
      await vanityNameRegistration.registerDomain(domainName,secret,{value:value})
    })

    it("Should able to transfered domain name to another address", async function () {

      await vanityNameRegistration.transferDomain(domainNameHash,account2.address)
    });
  
    it("Should not able to transfered domain to null address", async function () {
  
      await expect(vanityNameRegistration.transferDomain(domainNameHash,ethers.constants.AddressZero))
      .to.be.revertedWith("not a valid user")
    });

    it("Should able to renew previous domain name", async function () {

      await expect(vanityNameRegistration.renew(domainNameHash,{value:value.div(3)}))
      .emit(vanityNameRegistration,"DomainRenewed")
      .withArgs(account1.address,domainNameHash)
    });

    it("Should not able to renew previous domain name if less than 1 ether", async function () {
      const newValue = utils.parseUnits("0.1",18)
      await expect(vanityNameRegistration.renew(domainNameHash,{value:newValue}))
      .to.be.revertedWith("not enough eth")
    });

    it("Should able to unlock amount by after expiring", async function () {
      const account1BalanceBefore = await account1.getBalance();

      const registeredTime =  await vanityNameRegistration.registeredTime() ;
      const increasedTime = registeredTime.toNumber()*(1 + domainName.length)

      await ethers.provider.send("evm_increaseTime", [increasedTime]);
      await ethers.provider.send("evm_mine");

      const tx = await vanityNameRegistration.expireDomain(domainNameHash)
      const receipt = await tx.wait();
      const txGasCost = receipt.cumulativeGasUsed.mul(receipt.effectiveGasPrice)
      const account1BalanceAfter = await account1.getBalance();
      const updatedBalance = account1BalanceAfter.sub(account1BalanceBefore);
      expect(updatedBalance.add(txGasCost)).to.equal(value)
      
    });

    it("Should not able to unlock amount by before expiring",async()=>{
      await expect(vanityNameRegistration.expireDomain(domainNameHash))
      .to.be.revertedWith("Domain not expired yet")
    })

  })

});
