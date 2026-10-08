// Descriptive identity only: this directory never supplies review coverage.
// Source: Aave's published Ethereum V4 deployment table, captured in the Aave evidence packet.
export const aaveEthereumDeployments={
 '0x94e7a5dcbe816e498b89ab752661904e2f56c485':'Main Spoke',
 '0xcca852bc40e560adc3b1cc58ca5b55638ce826c9':'Liquidity Hub',
 '0x08ae3be30958cdd1847ec58fffd4c451a87fdf01':'Access Manager'
};
export function aaveDeployment(chainId,address){const market=chainId==='1'&&typeof address==='string'?aaveEthereumDeployments[address.toLowerCase()]:null;return market?{name:'Aave V4',network:'Ethereum',market,source:'PUBLISHED_DEPLOYMENT',sourceUrl:'https://www.aave.com/docs/resources/addresses'}:null;}
