import {aaveDeployment} from './aave-directory.mjs';
// Descriptive deployment identity only. This never grants review coverage.
export const MORPHO_BLUE_ETHEREUM='0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb';
export function protocolDeployment(chainId,address){return aaveDeployment(chainId,address)??(chainId==='1'&&typeof address==='string'&&address.toLowerCase()===MORPHO_BLUE_ETHEREUM?{name:'Morpho Blue',network:'Ethereum',market:'Isolated lending markets',source:'PUBLISHED_DEPLOYMENT',sourceUrl:'https://docs.morpho.org/developers/contracts/addresses/'}:null);}
