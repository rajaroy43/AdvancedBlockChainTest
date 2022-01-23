//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


//Using commit-phase reveal method for saving us from front-runners
contract VanityNameRegistration {

    struct Record {
        address owner;
        uint256 ttl;
        uint256 balance;
    }

    uint256 public constant registrationFee = 1 ether;
    uint256 public constant registeredTime = 2 weeks;
    uint256 public constant maxCommitmentTime = 1 days;

    mapping(bytes32=>uint256) public commitments;
    
    //keccak256 of name provided (keccak256(abhishek.ray))
    mapping (bytes32 => Record) public records;


    modifier authorised(bytes32 node) {
        address owner = records[node].owner;
        require(owner == msg.sender,"not authorised user");
        _;
    } 

    //EVENTS

    event DomainRegistered(address indexed owner,bytes32 domain,uint256 valueSend);
    event Commited(address indexed user,bytes32 commitment);
    event DomainTransfered(address indexed owner,address indexed newDomainOwner ,bytes32 domain);
    event DomainRenewed(address indexed owner,bytes32 domainName);
    event DomainExpired(address indexed owner,bytes32 domainName);


    constructor()  {
        records[0x0].owner = msg.sender;
        records[0x0].ttl = type(uint256).max;
    }

    //NOTE
    //Not checking some validatons as space in domainMame,special characters,etc
    
    function registerDomain(string memory  domain,bytes32 secret) external payable  {
        bytes32  domainName = getHash(domain);
        require(records[domainName].owner == address(0),"Already registered");
        require(msg.value >= registrationFee * (1 + bytes(domain).length),"not enough registrationFee");
        bytes32 commitment = getCommitment(domain, msg.sender, secret);

        require(commitments[commitment] != 0 ,"User don't commited thier secret yet");
        require(commitments[commitment] + maxCommitmentTime > block.timestamp,"commitment time over");

        commitments[commitment] = 0;
        records[domainName].owner = msg.sender;
        records[domainName].ttl = block.timestamp + (registeredTime * msg.value)/1e18 ;
        records[domainName].balance = msg.value;

        emit DomainRegistered(msg.sender,domainName,msg.value);
    }

    function commit(bytes32 commitment) public {
        require(commitments[commitment] + maxCommitmentTime < block.timestamp,"commitment is in progress");
        commitments[commitment] = block.timestamp;
        emit Commited(msg.sender,commitment);
    }


    function transferDomain(bytes32 domainName,address transferedUser)external authorised(domainName){
        require(transferedUser != address(0),"not a valid user");
        records[domainName].owner = transferedUser ;
        emit DomainTransfered(msg.sender,transferedUser,domainName);
    }


    function renew(bytes32 domainName) external payable  authorised(domainName) {
        require(msg.value >= 1 ether,"not enough eth");
        records[domainName].balance += msg.value;
        records[domainName].ttl += (registeredTime * msg.value)/1e18 ;
        emit DomainRenewed(msg.sender,domainName);
    }

    function expireDomain(bytes32 domainName)public authorised(domainName){
        require(isRegistrationExpire(domainName),"Domain not expired yet");
        uint256 transferedValue = records[domainName].balance;
        address owner = records[domainName].owner ;
        records[domainName].balance = 0;
        records[domainName].ttl = 0;
        records[domainName].owner = address(0);
        payable(owner).transfer(transferedValue);
        emit DomainExpired(msg.sender,domainName);
    }

    function isRegistrationExpire(bytes32 domainName)public view returns(bool){
        require( records[domainName].owner != address(0),"no user registered this domain name");
        return records[domainName].ttl < block.timestamp;
    }


    function toLower(string memory str) internal pure returns (string memory) {
        bytes memory bStr = bytes(str);
        bytes memory bLower = new bytes(bStr.length);
        for (uint i = 0; i < bStr.length; i++) {
            // Uppercase character...
            if ((uint8(bStr[i]) >= 65) && (uint8(bStr[i]) <= 90)) {
                // So we add 32 to make it lowercase
                bLower[i] = bytes1(uint8(bStr[i]) + 32);
            } else {
                bLower[i] = bStr[i];
            }
        }
        return string(bLower);
    }

    //secret is keecak256(secret-password)

    function getCommitment(string memory domain, address owner, bytes32 secret) pure public returns(bytes32) {
        require(owner != address(0),"Owner address can't be null");
        return keccak256(abi.encodePacked(toLower(domain), owner, secret));   
    }

    function getHash(string memory value)public pure returns(bytes32){
        return keccak256(bytes(toLower(value)));
    } 

}