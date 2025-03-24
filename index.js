function addTally()
{
    //Variables de obtencion y creacion
    const contenedorTallys = document.getElementById("contTallys");
    const nuevoTally = document.createElement("li");

    //Obtiene el ultimo grupo de tallys o crea uno si no existe
    let grupo = contenedorTallys.querySelectorAll('.grupo');
    let ultimoGrupo = grupo[grupo.length - 1];

    if(!ultimoGrupo || ultimoGrupo.childElementCount >= 5)
    {
        //Crea un nuevo grupo de tallys
        ultimoGrupo = document.createElement('div');
        ultimoGrupo.classList.add('grupo');
        contenedorTallys.appendChild(ultimoGrupo);
    }

    //Añade un tally al grupo actual
    //Creacion de un elemento tally
    nuevoTally.setAttribute("id", "tally");

    //Adicion del tally en el contenedor
    ultimoGrupo.appendChild(nuevoTally);

    //Actualiza el contador
    actCounter();
    
}

function delTally()
{
    //Variable de obtencion
    const contenedorTallys = document.getElementById("contTallys");
    //LLama al ultimo grupo de tallys
    const grupoDel = contenedorTallys.querySelectorAll('.grupo');
    const ultimoGrupoDel = grupoDel[grupoDel.length - 1];

    //Elimina el ultimo tally de este grupo
    ultimoGrupoDel.removeChild(ultimoGrupoDel.lastChild);
    //En caso de que el grupo esté vacío
    if( ultimoGrupoDel.childElementCount === 0)
    {
        contenedorTallys.removeChild(ultimoGrupoDel);
    }

    //Actualiza el contador
    actCounter();
}

function actCounter()
{
    //Llama a la lista y obtiene la cantidad de "li"s existentes
    var tallysNumber = document.getElementById("contTallys").getElementsByTagName("li").length;
    //Obtiene la cantidad de elementos de la lista y actualiza el contador
    var getCont = document.getElementById("counter");
    getCont.textContent = tallysNumber;
}