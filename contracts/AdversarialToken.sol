// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
interface ITestVault { function claim(bytes32 pool,uint256 epoch,address token) external; }
/// @dev Test fixture only. Never allowlist or deploy as a supported asset.
contract AdversarialToken is ERC20 {
    address public target;bytes32 public pool;bool public armed;bool public blocked;bool public taxed;
    constructor() ERC20("Adversarial fixture","BAD") {_mint(msg.sender,1e24);}
    function arm(address vault,bytes32 p,bool tax) external {target=vault;pool=p;armed=true;taxed=tax;}
    function runClaim() external {ITestVault(target).claim(pool,1,address(this));}
    function _update(address from,address to,uint256 amount) internal override {
        if(armed && from==target){
            armed=false;
            (bool ok,)=target.call(abi.encodeCall(ITestVault.claim,(pool,1,address(this))));blocked=!ok;
        }
        if(taxed && to==target && amount>0){super._update(from,address(0),1);amount-=1;}
        super._update(from,to,amount);
    }
}
