import {openExplorer} from './realm-explorer.js';
const shell=document.querySelector('.survey-shell');
openExplorer(shell).catch(e=>{shell.querySelector('.survey-caption').textContent=e.message||'The landscape could not open. Return to the journey to use the illustrated map.';});
