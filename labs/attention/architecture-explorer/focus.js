// Browser-page expansion. Native dialog supplies keyboard containment and Escape.
// Move existing nodes rather than cloning controls or creating another WebGL context.
export function mountFocusMode(){
 const root=document.getElementById('explorer'),dialog=document.getElementById('explorer-dialog'),button=document.getElementById('expand-explorer');
 const settings=document.getElementById('model-settings'),tools=document.getElementById('component-tools'),bar=root.querySelector('.explorer-modebar');
 const home=document.createComment('Explorer returns here');root.before(home);
 let saved=null,moved=[];
 function restore(){
  if(!saved)return;
  home.after(root);root.classList.remove('focus-mode');
  for(const {node,parent,next}of moved)parent.insertBefore(node,next?.isConnected?next:null);
  moved=[];settings.open=saved.settings;tools.open=saved.tools;document.body.style.overflow=saved.overflow;
  button.textContent='Expand explorer';button.setAttribute('aria-expanded','false');
  window.scrollTo(saved.x,saved.y);button.focus({preventScroll:true});saved=null;
 }
 function move(node,parent=bar,next=button){if(!node)return;moved.push({node,parent:node.parentNode,next:node.nextSibling});parent.insertBefore(node,next);}
 function expand(){
  saved={settings:settings.open,tools:tools.open,overflow:document.body.style.overflow,x:scrollX,y:scrollY};
  root.classList.add('focus-mode');dialog.append(root);
  if(matchMedia('(max-width: 800px)').matches){settings.open=false;tools.open=false;}
  // Shared symbol tooltip must share the dialog's top layer; handlers stay intact.
  move(document.querySelector('.symbol-tip'));move(document.querySelector('.theme-toggle'));
  move(tools,document.getElementById('inspector'),null);
  document.body.style.overflow='hidden';button.textContent='Exit expanded view';button.setAttribute('aria-expanded','true');
  dialog.showModal();button.focus({preventScroll:true});
 }
 function close(){if(dialog.open)dialog.close();restore();}
 button.hidden=false;button.addEventListener('click',()=>{if(dialog.open)close();else expand();});
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 dialog.addEventListener('close',restore);
 return {close};
}
