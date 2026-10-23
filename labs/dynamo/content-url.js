export function contentURL(file,moduleURL){const result=new URL(file,moduleURL);result.search=new URL(moduleURL).search;return result.href;}
