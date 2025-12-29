const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let gameState = {
    drawnNumbers: [],
    players: {}, 
    isGameActive: false
};

// --- GENERADOR DE CARTÓN DE 90 BOLAS ---
// Codigo de https://discoduroderoer.es/crea-cartones-de-bingo-automaticamente-en-java/
function generateCard90() {
    // Estructura base: 3 filas, 9 columnas
    let card = new Array(3).fill().map(() => new Array(9).fill(0));
    rellenarNumeros(card);
    ordenarColumnas(card);
    marcarHuecos(card);
    /*
    
    // Columnas: rangos de decenas. 
    // Col 0: 1-9, Col 1: 10-19... Col 8: 80-90
    let columns = [];
    for (let i = 0; i < 9; i++) {
        let min = (i === 0) ? 1 : i * 10; // La primera col empieza en 1, no 0
        let max = (i === 8) ? 90 : (i * 10) + 9;
        
        // Generamos números candidatos para esta columna
        let availableNums = [];
        for (let n = min; n <= max; n++) availableNums.push(n);
        
        // Mezclamos
        availableNums.sort(() => Math.random() - 0.5);
        columns.push(availableNums);
    }
    
    for (let r = 0; r < 3; r++) {
        let positions = [0,1,2,3,4,5,6,7,8];
        positions.sort(() => Math.random() - 0.5);
        let rowIndices = positions.slice(0, 5); // Elegimos 5 columnas para esta fila
        
        rowIndices.forEach(colIndex => {
            // Sacamos un número de la reserva de esa columna
            let num = columns[colIndex].pop();
            // Si por azar se acabaron los números de esa columna (raro), buscamos otro,
            // pero con el pool de 1-90 es difícil que pase en 3 filas.
            if(num) card[r][colIndex] = num;
        });
    }
    
    // Ordenar las columnas de arriba a abajo para que queden bonitas
    for(let c=0; c<9; c++){
        let numsInCol = [];
        for(let r=0; r<3; r++) if(card[r][c] !== 0) numsInCol.push(card[r][c]);
        numsInCol.sort((a,b)=>a-b);
        // Recolocar ordenados (rellenando desde arriba o manteniendo huecos es complejo, 
        // aquí simplemente los ponemos donde cayeron pero ordenados si hubiera coincidencia vertical)
        // Para simplificar visualización: dejamos el 0 como hueco.
    }

    */
    return card;
}

function rellenarNumeros(card) {
    let numAleatorio;
    let repetido = false;

    for (let j = 0; j < card[0].length; j++) {
        for (let i = 0; i < card.length; i++) {
            do {
                repetido = false;
                switch (j) {
                    case 0:
                        numAleatorio = generarNumeroAleatorio(1, 9);
                        break;
                    case 8:
                        numAleatorio = generarNumeroAleatorio(80, 90);
                        break;
                    default:
                        numAleatorio = generarNumeroAleatorio(10 * j, (10 * j) + 9);
                        break;
                }

                if (i == 1 && card[0][j] == numAleatorio) {
                    repetido = true;
                } else if (i == 2 && (card[0][j] == numAleatorio || card[1][j] == numAleatorio)) {
                    repetido = true;
                }
            } while(repetido);

            card[i][j] = numAleatorio;
        }
    }
}

function ordenarColumnas(card) {
    let numeros = new Array(3).fill().map(() => 0);
    for (let j = 0; j < card[0].length; j++) {
        for (let i = 0; i < card.length; i++) {
            numeros[i] = card[i][j];
        }

        numeros.sort((a,b)=>a-b);

        for (let i = 0; i < card.length; i++) {
            card[i][j] = numeros[i];
        }
    }
}

function marcarHuecos(card) {
    let distribucion = [1, 1, 1, 1, 1, 1, 1, 1, 1];
    let posAleatoria;

    for (let i = 0; i < 3; i++) {
        do {
            posAleatoria = generarNumeroAleatorio(0, distribucion.length - 1);
        } while (distribucion[posAleatoria] == 2);
        distribucion[posAleatoria] = 2;
    }

    let numHuecos = new Array(3).fill().map(() => 0);
    let huecoDisponible = new Array(3).fill().map(() => false);
    let menor, filaAleatoria, posOcupadas;
    let iguales = false;
    for (let j = 0; j < card[0].length; j++) {
        huecoDisponible.fill(true);

        iguales = true;
        for (let i = 0; i < numHuecos.length - 1 && iguales; i++) {
            if (numHuecos[i] != numHuecos[i + 1]) {
                iguales = false;
            }
        }

        if (!iguales) {
            menor = numHuecos[0];
            for (let i = 1; i < numHuecos.length; i++) {
                if (numHuecos[i] < menor) {
                    menor = numHuecos[i];
                }
            }

            for (let i = 0; i < huecoDisponible.length; i++) {
                if (numHuecos[i] != menor) {
                    huecoDisponible[i] = false;
                }
            }
        }

        do {
            filaAleatoria = generarNumeroAleatorio(0, card.length - 1);
        } while (!huecoDisponible[filaAleatoria] || card[filaAleatoria][j] == -1);

        card[filaAleatoria][j] = -1;
        numHuecos[filaAleatoria]++;
        if (distribucion[j] == 2) {
            posOcupadas = 0;
            for (const element of card) {
                if (element[j] == -1) {
                    posOcupadas++;
                }
            }

            if (posOcupadas < distribucion[j]) {
                j--;
            }
        }
    }
}

function generarNumeroAleatorio(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

io.on('connection', (socket) => {
    console.log('Usuario:', socket.id);

    socket.on('start-game', () => {
        gameState.drawnNumbers = [];
        gameState.isGameActive = true;
        gameState.players = {};
        io.emit('game-reset');
    });

    socket.on('draw-ball', () => {
        if (!gameState.isGameActive) return;
        let num;
        do {
            num = Math.floor(Math.random() * 90) + 1; // 1 a 90
        } while (gameState.drawnNumbers.includes(num) && gameState.drawnNumbers.length < 90);

        gameState.drawnNumbers.push(num);
        io.emit('new-number', num);
    });

    socket.on('request-card', () => {
        const card = generateCard90();
        gameState.players[socket.id] = card;
        socket.emit('card-assigned', card);
        socket.emit('sync-state', gameState.drawnNumbers);
    });

    socket.on('check-bingo', () => {
        const playerCard = gameState.players[socket.id];
        if (!playerCard) return;

        // Aplanar cartón y quitar los 0 (huecos)
        const numbersOnly = playerCard.flat().filter(n => n !== 0);
        
        const hasWon = numbersOnly.every(num => gameState.drawnNumbers.includes(num));

        if (hasWon) {
            io.emit('game-over', { winner: socket.id });
            gameState.isGameActive = false;
        } else {
            socket.emit('false-bingo');
        }
    });
});

server.listen(3000, '0.0.0.0', () => {
    console.log('Servidor corriendo. Accesible en red local.');
});