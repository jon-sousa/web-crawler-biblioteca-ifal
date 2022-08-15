require('dotenv').config()
const express = require('express')
const puppeteer = require('puppeteer')
const app = express()
const cors = require('cors')

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors())



app.post('/', async (req, res) => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox','--disable-setuid-sandbox']
    });
    try{
        tipo = req.body.tipo
        campo = req.body.campo
        semDisponibilidade = req.body.semDisponibilidade
        
        if(!tipo || !campo){
            return res.status(403).send('Requisicao Vazia')
        }

        var livros = []
        var anchors
        
        const page = await browser.newPage();
        await page.goto('https://sigaa.ifal.edu.br/sigaa/public/biblioteca/buscaPublicaAcervo.jsf?aba=p-biblioteca', {timeout: 0});
        
        if(tipo == 'livro'){
            await page.type('[name="formBuscaPublica:j_id_jsp_1110046903_41"]', campo)
        }
        
        if(tipo == 'autor'){
            await page.type('[name="formBuscaPublica:j_id_jsp_1110046903_43"]', campo)
        }
        
        if(tipo == 'assunto'){
            await page.type('[name="formBuscaPublica:j_id_jsp_1110046903_45"]', campo)
        }
        
        await page.select('select[name="formBuscaPublica:j_id_jsp_1110046903_58"]', '3')
        
        await Promise.all([
            page.click('[name="formBuscaPublica:botaoPesquisarPublicaMulti"]'),
            page.waitForNavigation()
        ])
        //await page.click('[name="formBuscaPublica:botaoPesquisarPublicaMulti"]')
        //await page.waitForSelector('tr')
        
        result = await page.evaluate(() => {
            livros = []
            const tabela = document.querySelector('#listagem')
            console.log('hello, human')
            
            if(!tabela?.children[2]?.children){
                return null
            }
            
            linhas = tabela?.children[2]?.children
            
            for(let i = 0; i < linhas.length; i+=2){
                let celulas = linhas[i].children
                console.log(`${celulas[0].innerText} - ${celulas[1].innerText}`)
                livros.push({autor: celulas[0].innerText, livro: celulas[1].innerText})
            }
            
            anchors = document.querySelectorAll('td a')
            return {livros, anchors}
        });
        
        if(!result){
            livros = ['Livro não encontrado no acervo']
            console.log(JSON.stringify(livros))
            return res.status(200).json(livros)
        }
        
        livros = result.livros

        if(semDisponibilidade){
            return res.status(200).json(livros)
        }

        anchors = await page.$$('td a')
        console.log(JSON.stringify(anchors))
        
        for(let k=0; k < anchors.length; k++){
            anchors = await page.$$('td a')
            console.log('dentro do anchor loop')
            await anchors[k].click()
            await page.waitForNavigation()
            
            let disponibilidade = await page.evaluate(() => {
                let emprestimos = document.querySelectorAll('tr .biblioteca')
                let disp = []
                
                for(let i=0; i<emprestimos.length; i++){
                    console.log('dentro do biblioteca loop')
                    if(emprestimos[i].lastElementChild.innerText == 'CAMPUS ARAPIRACA'){
                        let nextSibling = emprestimos[i].nextElementSibling
                        while(true){
                            console.log(nextSibling.lastElementChild.innerText)
                            console.log('dentro do livros loop')
                            disp.push(nextSibling.lastElementChild.innerText)
                            
                            nextSibling = nextSibling.nextElementSibling.nextElementSibling.nextElementSibling
                            
                            if(nextSibling?.className == 'biblioteca' || nextSibling == null){
                                break
                            }
                        }
                    }
                }
                
                return disp
            })
            
            console.log(disponibilidade)
            
            console.log('esperando a navegacao...')
            await Promise.all([
                page.goBack(),
                page.waitForNavigation()
            ])
            console.log('fim do loop')
            livros[k].disponibilidade = disponibilidade
            
        }    
        
        console.log(JSON.stringify(livros))
        return res.status(200).json(livros)
        //await page.screenshot({path: 'example.png'});
    }   
    catch(e){
        console.log(e)
        await browser.close()
        return res.status(500).json(e)
    }     
});

var port = process.env.PORT || '8080' 
app.listen(port, () => console.log(`Server listening ${port} port`))