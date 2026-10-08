import {Box,Section,Row,Text,Heading,Image,Button,Link,Address} from '@metamask/snaps-sdk/jsx';
import {safeText} from './validate.mjs';
const txt=v=>safeText(v);
const url=v=>{try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}};
const xml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const palette={VERIFIED:'#CEF549',PARTIAL:'#FDE04C',CHANGED:'#EF6959',UNKNOWN:'#A5AAB3'};
const symbols={VERIFIED:'✓',CHANGED:'≠',UNKNOWN:'?'};
// Generated locally from authenticated runtime parentage. No remote image loads,
// untrusted SVG markup, invented edges or color-only evidence semantics.
const short=(v,max)=>{const value=txt(v);return value.length>max?value.slice(0,max-1)+'…':value;};
export function pathDiagram(view,selected){
 const nodes=view.path.slice(0,12),proxy=['ERC1967','BEACON','ERC1167'].includes(view.routing),offset=proxy?92:14,height=nodes.length*128+offset+12;
 const entry=proxy?`<rect x="14" y="12" width="292" height="64" rx="10" fill="#1B1B1E" stroke="#A5AAB3" stroke-width="2"/><text x="28" y="38" fill="#F7F5E9" font-size="18" font-family="sans-serif">◇ Proxy · ${xml(view.routing)}</text><text x="28" y="60" fill="#A5AAB3" font-size="13" font-family="sans-serif">Routing step · not a review claim</text>`:'';
 const cards=nodes.map((n,i)=>{const x=14+Math.min(n.level??0,3)*8,y=offset+i*128,color=palette[n.state]??palette.UNKNOWN,parent=nodes.findIndex(p=>p.id===n.parent),linked=view.pathConfirmed&&parent>=0,edge=linked?`<path d="M ${x+8} ${offset+parent*128+110} V ${y-8} H ${x+18}" fill="none" stroke="#A5AAB3" stroke-width="2"${n.state==='UNKNOWN'?' stroke-dasharray="3 4"':''}/>`:'';
 const status=n.state==='VERIFIED'?'✓ Reviewed code is live':n.state==='CHANGED'?'≠ Reviewed code changed':'? Review not confirmed';
 return edge+`<rect x="${x}" y="${y}" width="${306-x}" height="110" rx="10" fill="#1B1B1E" stroke="${color}" stroke-width="2"${n.state==='UNKNOWN'?' stroke-dasharray="3 4"':n.state==='CHANGED'?' stroke-dasharray="8 3"':''}/>${selected===n.index?`<rect x="${x+1}" y="${y+12}" width="4" height="86" rx="2" fill="#4D59E3"/>`:''}<text x="${x+14}" y="${y+26}" fill="#F7F5E9" font-size="18" font-weight="bold" font-family="sans-serif">${xml('▣ '+short(n.name,23))}</text><text x="${x+14}" y="${y+49}" fill="#A5AAB3" font-size="14" font-family="sans-serif">${xml(short(n.functionLabel,31))}</text><text x="${x+14}" y="${y+73}" fill="${color}" font-size="14" font-family="sans-serif">${xml(status)}</text><text x="${x+14}" y="${y+96}" fill="#F7F5E9" font-size="13" font-family="sans-serif">${xml(n.auditor?short('Reviewer: '+n.auditor,35):'Reviewer not confirmed')}</text>`;
 });
 return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="${height}" viewBox="0 0 320 ${height}"><rect width="320" height="${height}" rx="12" fill="#0F0F10"/>${entry}${cards.join('')}</svg>`;
}
function activityDiagram(daily){const max=Math.max(1,...daily);return `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="66" viewBox="0 0 280 66"><rect width="280" height="66" rx="8" fill="#0F0F10"/>${daily.map((v,i)=>`<rect x="${14+i*37}" y="${52-v/max*40}" width="24" height="${v/max*40}" rx="2" fill="#A5AAB3"/>`).join('')}<path d="M 10 54 H 270" stroke="#A5AAB3"/></svg>`;}
export function WalletPath({view,selected}){return <Box>
 {view.path.length>0&&<Image src={pathDiagram(view,selected)} alt={txt(view.path.slice(0,12).map(n=>n.name+' · '+(symbols[n.state]??'?')+(n.auditor?' '+n.auditor:' Review not confirmed')+' '+n.review).join('; '))}/>}
 {view.path.length>12&&<Text size="sm" color="muted">Diagram shows the first 12 runtime steps. Expand the full execution path for the remaining calls.</Text>}
 <Text size="sm" color="muted">Select a part for evidence.</Text>
 {view.nodes.slice(0,24).map(n=><Button name={'poa-node-'+n.index} size="sm">{txt((selected===n.index?'● ':'')+'Inspect '+n.name+' · '+(symbols[n.state]??'?'))}</Button>)}
 {view.nodes.length>24&&<Text size="sm" color="muted">Additional parts remain in the full execution path and exact proof.</Text>}
 </Box>;}
export function WalletInspector({view,selected,path}){
 const n=view.nodes[selected];if(!n)return null;const report=url(n.report);const chain=n.onchainActivity;
 return <Section>
 <Heading>{txt('Selected · '+n.name)}</Heading>
 <Text fontWeight="bold">{txt(n.auditor??'? Reviewer not confirmed')}</Text>
 <Text size="sm">{txt(n.granularity??n.review)}</Text>
 {n.demo&&<Text size="sm" color="muted">Synthetic demo evidence</Text>}
 {report&&<Link href={report}>Audit report · {txt(n.reviewDate??'date unknown')} ↗</Link>}
 <Heading size="sm">Reviewed ↔ Live</Heading>
 <Image src={revisionDiagram(n)} alt={txt('Reviewed '+n.reviewedRevision+'; live '+n.liveRevision+'; '+n.live)}/>
 <Text size="sm">{txt(n.live)}</Text>
 <Text size="sm" color="muted">{txt(n.change==='Change time not established'?'? Exact change time unknown':n.change)}</Text>
 <Heading size="sm">On-chain activity</Heading>
 {chain?.available?<Box>
 <Row label="Top-level transactions"><Text>{chain.today+' / '+chain.last7d}</Text></Row>
 <Image src={activityDiagram(chain.daily)} alt={txt('Daily confirmed selector transactions, oldest to newest: '+chain.daily.join(', '))}/>
 <Text size="sm" color="muted">{txt(chain.disclosure)}</Text>
 <Text size="sm" color="muted">{txt((chain.stale?'Activity data delayed · ':'Indexed through ')+chain.indexedThrough)}</Text>
 </Box>:<Text size="sm" color="muted">{txt(chain?.reason??'? History not indexed yet')}</Text>}
 <Heading size="sm">Control</Heading>
 {n.control.threshold&&<Text>{txt('●'.repeat(Math.min(n.control.threshold,20))+'○'.repeat(Math.min(n.control.members.length-n.control.threshold,20))+' · '+n.control.threshold+' / '+n.control.members.length+' reported approvals')}</Text>}
 <Text>{txt(n.control.line)}</Text>
 {n.control.controller&&<Address address={n.control.controller}/>}
 <Text size="sm" color="muted">{txt(n.control.delay==='No confirmed delay'?'? Delay not confirmed':n.control.delay??'? Delay not confirmed')}</Text>
 {!!n.control.detail&&<Text size="sm" color="muted">{txt(n.control.detail)}</Text>}
 {!!n.control.moduleWarning&&<Text size="sm" color="muted">{txt(n.control.moduleWarning)}</Text>}
 <Text size="sm" color="muted">? Pause authority unknown</Text>
 <Link href={POA_PASSPORT_URL+path+'#review-node-'+n.index}>Evidence for this part →</Link>
 </Section>;
}
function revisionDiagram(n){const known=n.reviewedRevision&&n.reviewedRevision!=='Not established'&&n.liveRevision&&n.liveRevision!=='Not established',match=known&&n.state==='VERIFIED',changed=known&&n.state==='CHANGED',symbol=match?'✓':changed?'≠':'?',color=match?palette.VERIFIED:changed?palette.CHANGED:palette.UNKNOWN;return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="90" viewBox="0 0 320 90"><rect width="320" height="90" rx="10" fill="#0F0F10"/><text x="14" y="23" fill="#A5AAB3" font-size="13" font-family="sans-serif">REVIEWED</text><text x="214" y="23" fill="#A5AAB3" font-size="13" font-family="sans-serif">LIVE</text><text x="14" y="50" fill="#F7F5E9" font-size="12" font-family="monospace">${xml(n.reviewedRevision==='Not established'?'?':n.reviewedRevision)}</text><text x="202" y="50" fill="#F7F5E9" font-size="12" font-family="monospace">${xml(n.liveRevision==='Not established'?'?':n.liveRevision)}</text><path d="M 128 44 H 146 M 174 44 H 192" stroke="${color}" stroke-width="2"${!known?' stroke-dasharray="3 4"':''}/><text x="153" y="49" fill="${color}" font-size="20">${symbol}</text><text x="160" y="75" text-anchor="middle" fill="${color}" font-size="13" font-family="sans-serif">${match?'SAME REVIEWED CODE':changed?'CODE CHANGED':'COMPARISON UNKNOWN'}</text></svg>`;}
export function WalletHolders({view,expanded,path}){return <Box>
 <Heading size="sm">Key holders</Heading>
 {view.holders.map(h=><Box><Text size="sm">{txt(h.knownWallet?h.members.length+' observed key holder'+(h.members.length===1?'':'s'):'? Controller set not fully confirmed')}</Text><Text size="sm" color="muted">{txt((h.evidence?.filter(e=>e.verificationStatus==='POA_VERIFIED').length??0)+' identities verified · '+(h.evidence?.some(e=>e.interviews?.length)?'▶ Interview evidence available':'Interview: No verified artifact · request status unknown'))}</Text></Box>)}
 {!view.holders.length&&<Text size="sm" color="muted">? Controller set not fully confirmed · □ Interview not available</Text>}
 <Button name="poa-toggle-holders" size="sm">{expanded?'Hide key holders':'Inspect selected key holders'}</Button>
 {expanded&&view.holders.map(h=><Section>
 <Heading size="sm">{txt(h.component+' · controller')}</Heading>
 <Row label="Controller"><Address address={h.controller}/></Row>
 <Text size="sm" color="muted">{h.knownWallet?'Observed key holders':'Controller contract · signer membership not confirmed'}</Text>
 {h.knownWallet&&h.members.slice(0,20).map(address=>{const e=h.evidence?.find(e=>e.address.toLowerCase()===address.toLowerCase()),verified=e?.verificationStatus==='POA_VERIFIED'&&e.identity;return <Box>
 <Row label={verified?'✓ Identified key holder':'? Unverified key holder'}><Address address={address}/></Row>
 {verified?<Text size="sm">{txt(e.identity.entity+' · '+e.identity.role+' · POA identity verified')}</Text>:<Text size="sm" color="muted">? Identity and role not verified</Text>}
 <Text size="sm" color="muted">{txt(e?.interviews?.length?e.interviews.length+' verified interview artifacts':'Interview: No verified artifact · request status unknown')}</Text>
 {e?.interviews?.length>0&&<Link href={POA_PASSPORT_URL+path+'#controller-'+address.toLowerCase()}>▶ View interview evidence →</Link>}
 <Link href={POA_PASSPORT_URL+path+'#controller-'+address.toLowerCase()}>Key-holder evidence →</Link>
 </Box>;})}
 {h.members.length>20&&<Text size="sm" color="muted">More key holders in the exact proof.</Text>}
 </Section>)}
 </Box>;}

export function WalletLegend({expanded}){return <Box>
 <Button name="poa-toggle-legend" size="sm">{expanded?'Hide symbol guide':'What do these symbols mean?'}</Button>
 {expanded&&<Section>
 <Heading size="sm">Read the evidence</Heading>
 <Row label="✓ Lime"><Text>Confirmed review matches live code</Text></Row>
 <Row label="◐ Yellow"><Text>Some review evidence is missing</Text></Row>
 <Row label="≠ Coral"><Text>Live code differs from its review</Text></Row>
 <Row label="? Gray"><Text>A fact is not established</Text></Row>
 <Row label="● Blue marker"><Text>The part you selected</Text></Row>
 <Row label="◇ / ▣ / ○"><Text>Proxy / contract / internal function</Text></Row>
 <Row label="ƒ / ≈"><Text>Exact function review / reviewed code version</Text></Row>
 <Row label="▶ Interview"><Text>Available verified interview evidence</Text></Row>
 <Text size="sm" color="muted">Solid, dotted and broken borders distinguish matched, unknown and changed code. Review evidence does not guarantee security.</Text>
 </Section>}
 </Box>;}
