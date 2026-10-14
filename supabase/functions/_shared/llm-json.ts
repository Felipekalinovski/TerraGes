export function parseModelJson(content:unknown):Record<string,any> {
 if(typeof content!=='string'||!content.trim())throw new Error('empty_model_json');
 const text=content.trim(),fenced=/^\x60\x60\x60(?:json)?\s*([\s\S]*?)\s*\x60\x60\x60$/i.exec(text);
 const parsed=JSON.parse(fenced?fenced[1]:text);
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('invalid_model_json');
 return parsed;
}
