// WORK only. The caller checks its unchanged left operand once per pass.
// This is a numeric ordinary-Matrix4 kernel, not arbitrary getter/Proxy parity.
export function positiveIdentity(matrix){const e=matrix.elements;return e[0]===1&&e[5]===1&&e[10]===1&&e[15]===1&&Object.is(e[1],0)&&Object.is(e[2],0)&&Object.is(e[3],0)&&Object.is(e[4],0)&&Object.is(e[6],0)&&Object.is(e[7],0)&&Object.is(e[8],0)&&Object.is(e[9],0)&&Object.is(e[11],0)&&Object.is(e[12],0)&&Object.is(e[13],0)&&Object.is(e[14],0);}
export function multiplyIdentityLeft(target,left,right,knownIdentity){
 if(!knownIdentity)return target.multiplyMatrices(left,right);
 const b=right.elements,b11=b[0],b12=b[4],b13=b[8],b14=b[12],b21=b[1],b22=b[5],b23=b[9],b24=b[13],b31=b[2],b32=b[6],b33=b[10],b34=b[14],b41=b[3],b42=b[7],b43=b[11],b44=b[15];
 // A finite sum implies all numeric inputs were finite. Finite overflow is a
 // conservative fallback. Exact positive affine bottom row makes all zero
 // results of native identity multiplication positive zero.
 if(!Object.is(b41,0)||!Object.is(b42,0)||!Object.is(b43,0)||b44!==1||!Number.isFinite(b11+b12+b13+b14+b21+b22+b23+b24+b31+b32+b33+b34))return target.multiplyMatrices(left,right);
 const t=target.elements;
 t[0]=b11===0?0:b11;t[4]=b12===0?0:b12;t[8]=b13===0?0:b13;t[12]=b14===0?0:b14;
 t[1]=b21===0?0:b21;t[5]=b22===0?0:b22;t[9]=b23===0?0:b23;t[13]=b24===0?0:b24;
 t[2]=b31===0?0:b31;t[6]=b32===0?0:b32;t[10]=b33===0?0:b33;t[14]=b34===0?0:b34;
 t[3]=0;t[7]=0;t[11]=0;t[15]=1;return target;
}
