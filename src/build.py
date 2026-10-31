import re,sys,os
os.chdir(os.path.dirname(os.path.abspath(__file__))+"/..")
src=os.environ.get('WU_SRC','/tmp/claude-0/-home-claude/18d9b475-1210-5b6d-9dc7-5b994acffb28/scratchpad/wu/index.html')
L=open(src,encoding='utf-8').read().split('\n')
head='\n'.join(L[:266])  # doctype .. end of base <style>
head=head.replace('<title>ชั้นวางติดผนัง DIY</title>','<title>FLEXI Organize 3D</title>')
head=head.replace('จัดชั้นวางติดผนังและ Wall Unit แบบ 3D/2D พร้อมระยะ และรายการสินค้า','จัดระบบรางติดผนัง FLEXI แบบ 3D/2D ชั้น ตะกร้า ราวแขวน พร้อมระยะและรายการสินค้า')
head=head.replace('content="ชั้นวาง DIY"','content="FLEXI 3D"').replace('#0149F2','#0755B5')
body=open('src/body.html',encoding='utf-8').read()
app=open('src/app.js',encoding='utf-8').read()
body=body.replace('<script src="app.js"></script>','<script>\n'+app+'\n</script>')
open('index.html','w',encoding='utf-8').write(head+'\n'+body)
