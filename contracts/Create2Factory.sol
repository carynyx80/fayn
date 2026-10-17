// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
contract Create2Factory {
    event Deployed(address indexed deployment,bytes32 salt);
    function deploy(bytes32 salt,bytes memory code) external returns(address result) {
        assembly { result := create2(0,add(code,32),mload(code),salt) }
        require(result!=address(0),"deployment failed"); emit Deployed(result,salt);
    }
}
