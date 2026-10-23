import {reconcileHistory,transferRange} from './membership.js?v=dynamo20261023-final';
export function controlPlane(index){
 if(index!==7 && index!==8)return null;
 const root=document.createElement('section');const title=document.createElement('h2');title.textContent=index===7?'Propagate an explicit membership change':'Confirm one range transfer';
 const output=document.createElement('pre');const controls=document.createElement('div');controls.className='controls';
 const button=(label,action)=>{const item=document.createElement('button');item.type='button';item.textContent=label;item.addEventListener('click',action);controls.append(item);};
 root.append(title,controls,output);
 if(index===7){
  let a=[{node:'B',action:'join',time:1}];let c=[...a];let unreachable=false;
  const show=()=>{output.textContent=`A’s persisted history: ${JSON.stringify(a)}\nC’s persisted history: ${JSON.stringify(c)}\nA can reach B: ${!unreachable}.\nOnly explicit leave changes membership. Gossip exchanges persisted histories. Toy arbitration uses latest issue time and leave for an exact tie; the paper does not specify concurrent-admin conflict arbitration.`;};
  button('Timeout contacting B',()=>{unreachable=true;show();});
  button('Admin removes B at A',()=>{a=reconcileHistory(a,[{node:'B',action:'leave',time:2}]);show();});
  button('Gossip A ↔ C',()=>{a=reconcileHistory(a,c);c=[...a];show();});
  button('Admin rejoins B at C',()=>{c=reconcileHistory(c,[{node:'B',action:'join',time:3}]);show();});
  button('Restart membership example',()=>{a=[{node:'B',action:'join',time:1}];c=[...a];unreachable=false;show();});show();
 }else{
  let state={received:[],pending:[]};let message='X joins between A and B; metadata alone has not copied its ranges.';
  const show=()=>{output.textContent=`${message}\nX needs (F,G], (G,A], (A,X] for three-copy placement.\nPending offers: ${JSON.stringify(state.pending)}\nReceived ranges: ${state.received.join(', ') || 'none'}\nA confirmed range must not be transferred twice; a transfer failure leaves it pending. This toy models confirmations, not concurrent update races or production disk scans.`;};
  for(const range of ['(F,G]','(G,A]','(A,X]'])button(`Offer ${range}`,()=>{transferRange(state,range,'donor',false);message=`Offer ${range}; destination has not confirmed delivery.`;show();});
  button('Confirm pending transfers',()=>{for(const item of [...state.pending])transferRange(state,item.range,item.donor,true);message='Confirmed transfers now appear at X.';show();});
  button('Repeat offer for (A,X]',()=>{const accepted=transferRange(state,'(A,X]','second donor',true);message=accepted?'Range arrived from donor.':'Duplicate range offer skipped after prior confirmation.';show();});
  button('Restart transfer example',()=>{state={received:[],pending:[]};message='X starts empty.';show();});show();
 }
 return root;
}
