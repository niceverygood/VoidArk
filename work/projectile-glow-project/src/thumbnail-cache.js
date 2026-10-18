// Cached canvases own only their copied pixels, never a model or GPU resource.
export class ThumbnailCache {
 constructor({maxBytes=8*1024*1024,maxEntries=24,dispose=value=>{value.width=value.height=0;}}={}){this.maxBytes=maxBytes;this.maxEntries=maxEntries;this.dispose=dispose;this.items=new Map();this.bytes=0;}
 get(key){const item=this.items.get(key);if(!item)return null;this.items.delete(key);this.items.set(key,item);return item.value;}
 set(key,value,bytes){if(!Number.isFinite(bytes)||bytes<0||bytes>this.maxBytes||this.maxEntries<1){this.dispose(value);return false;}const previous=this.items.get(key);if(previous){this.items.delete(key);this.bytes-=previous.bytes;if(previous.value!==value)this.dispose(previous.value);}this.items.set(key,{value,bytes});this.bytes+=bytes;while(this.bytes>this.maxBytes||this.items.size>this.maxEntries){const [old,item]=this.items.entries().next().value;this.items.delete(old);this.bytes-=item.bytes;this.dispose(item.value);}return true;}
 clear(){for(const item of this.items.values())this.dispose(item.value);this.items.clear();this.bytes=0;}
}
