document.getElementById('dxfFile').addEventListener('change', function(e) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        const entities = parseDXF(content);
        drawEntities(entities);
    };
    reader.readAsText(e.target.files[0]);
});

function parseDXF(text) {
    const lines = text.split('\n');
    let entities = [];
    let currentEntity = null;

    for (let i = 0; i < lines.length; i++) {
        let code = lines[i].trim();
        let val = lines[i+1] ? lines[i+1].trim() : "";

        if (code === '0' && val === 'LWPOLYLINE') {
            currentEntity = { type: 'LWPOLYLINE', points: [] };
            entities.push(currentEntity);
        } else if (currentEntity) {
            if (code === '10') currentEntity.points.push({ x: parseFloat(val) });
            if (code === '20') currentEntity.points[currentEntity.points.length - 1].y = parseFloat(val);
        }
        i++;
    }
    return entities;
}

function drawEntities(entities) {
    const canvas = document.getElementById('dxfCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    entities.forEach(ent => {
        if (ent.points.length >= 2) {
            ctx.beginPath();
            ctx.moveTo(ent.points[0].x + 400, ent.points[0].y + 300); // Offset to center
            ctx.lineTo(ent.points[1].x + 400, ent.points[1].y + 300);
            ctx.stroke();
        }
    });
}