import { RotacionTurnos } from '@/enums';
import store from '@/store/contrato';
import jsPDF, { jsPDFOptions } from 'jspdf';

interface CoordenadasCursor {
  x: number,
  y: number
}


interface IdentificacionPartes {
  fechaCelebracion: string
  comuna: string,
  trabajador: Trabajador,
  empleador: Empleador
}

declare type PageFormats = 'a4' | 'legal' | 'letter'

// NOTA: Si cambio la unidad a una diferente a 'pt' tenemos que usar
// internal.scaleFactor para redimensionar los calculos de nuestras fuentes
class PDFContrato {
  private pdf: jsPDF
  private posActualCursorEnPDF: CoordenadasCursor
  private options: jsPDFOptions = {
    format: 'a4',
    unit: 'pt',
    orientation: 'portrait'
  }
  private format: PageFormats
  private margenYDoc: number
  private margenXDoc: number
  private magnitudSaltoLinea: number
  private espacioEntreParrafos: number
  private fontSize: number
  private docInnerWidth: number
  private docInnerHeight: number

  private titulo: string
  private DENOMINACION_TRABAJADOR = 'EL TRABAJADOR'
  private DENOMINACION_EMPLEADOR = 'EL EMPLEADOR'

  constructor() {
    this.format = 'a4'
    this.options.format = this.format
    this.pdf = new jsPDF(this.options)
    this.fontSize = 12

    this.margenXDoc = 40/this.pdf.internal.scaleFactor
    this.margenYDoc = (this.fontSize + 40)/this.pdf.internal.scaleFactor
    this.docInnerWidth = (this.pdf.internal.pageSize.width - (this.margenXDoc*2))/this.pdf.internal.scaleFactor
    this.docInnerHeight = (this.pdf.internal.pageSize.height - (this.margenYDoc*2))/this.pdf.internal.scaleFactor
    this.magnitudSaltoLinea = this.pdf.getLineHeight()/this.pdf.internal.scaleFactor
    this.espacioEntreParrafos = 1

    this.titulo = 'Contrato de Trabajo'
    this.posActualCursorEnPDF = {x: this.margenXDoc, y: this.margenYDoc }
    this.pdf.setFontSize(this.fontSize)
    this.renderizarPDF(true)
  }

  renderizarPDF(debug?: boolean): void {
    const fechaActual = new Date().toLocaleString()
    const identificacionPartes: IdentificacionPartes = {
      fechaCelebracion: fechaActual,
      empleador: store.state.empleador,
      trabajador: store.state.trabajador,
      comuna: store.get('empleador', 'comuna').nombre
    }
    const condicionesContrato = store.state.condicionesContractuales
    this.agregarTitulo()
    this.agregarParrafoIdentificacionPartes(identificacionPartes)
    this.agregarParrafoFuncionesTrabajador(condicionesContrato)
    this.agregarParrafoLugarFunciones(condicionesContrato)
    this.agregarParrafoJornadaLaboral(condicionesContrato)
    this.agregarParrafoRemuneraciones(condicionesContrato)
    this.agregarParrafoObligacionesTrabajador()
    this.agregarParrafoDuracionContrato()
    this.agregaParrafoFechaCelebracion()
    this.agregarParrafoDomicilioJudicial(store.state.empleador)
    this.agregarParrafoEjemplares()
    this.agregarFirmas(store.state)
    this.agregarNotaFinesEducacionales()
    if (debug) {
      this.mostrarInfoDebug()
    }
  }

  output(): URL {
    return this.pdf.output('bloburi')
  }

  private agregarTitulo(): void {
    this.pdf.setFontSize(this.fontSize*1.7)
    const tamanhoTexto = this.pdf.getStringUnitWidth(this.titulo)*this.pdf.getFontSize()
    this.posActualCursorEnPDF.x = this.obtenerMitadHorizontalDePagina() - tamanhoTexto/2,
    this.pdf.text(this.titulo, this.posActualCursorEnPDF.x, this.posActualCursorEnPDF.y)
    this.pdf.setFontSize(this.fontSize)
    this.resetearCursorX()
    this.moverCursorY(this.magnitudSaltoLinea*3)
  }

  private agregarParrafoIdentificacionPartes(datos: IdentificacionPartes): void {
    const empleador = datos.empleador
    const trabajador = datos.trabajador
    let texto = `En ${datos.comuna}, a ${datos.fechaCelebracion}, entre ${empleador.razonSocial}, RUT ${empleador.rut} `
    if (empleador.nombreRepLegal.length > 0) {
      texto += `representada legalmente por don(??a) ${empleador.nombreRepLegal}, RUN ${empleador.rutRepLegal}, ambos `
    }
    texto += `con domicilio en ${empleador.domicilio}, comuna de ${empleador.comuna.nombre}, `+
    `Regi??n ${empleador.region.nombre}, en lo sucesivo "${this.DENOMINACION_EMPLEADOR}"; `

    texto += `y don(??a) ${trabajador.nombre} ${trabajador.apellidoPaterno} ${trabajador.apellidoMaterno}, `+
    `RUN ${trabajador.run}, de nacionalidad ${trabajador.nacionalidad}, nacido(a) el `+
    `${trabajador.fechaNac}, domiciliado en ${trabajador.direccion}, comuna de ${trabajador.comuna.nombre}, `+
    `Regi??n ${trabajador.region.nombre}, estado civil ${trabajador.estadoCivil}, en adelante `+
    `"${this.DENOMINACION_TRABAJADOR}", han convenido el siguiente contrato de trabajo:`
    this.resetearCursorX()
    this.escribirParrafo(texto)
    // console.log(`Numero de lineas escritas: ${lineasDeTexto.length}`)
  }

  private agregarParrafoFuncionesTrabajador(funcionesTrabajador: CondicionesContractuales): void {
    const condicionesContrato = funcionesTrabajador
    let texto = `PRIMERO - De la naturaleza de los servicios. ${this.DENOMINACION_TRABAJADOR} se compromete `+
      `a desempe??ar el cargo de: ${condicionesContrato.cargo}. `
    if (condicionesContrato.funciones.length > 0) {
      texto += `Dentro de sus funciones deber?? cumplir lo siguiente:\n`
      condicionesContrato.funciones.forEach(
        (funcion) => {
          texto += `\t${funcion}\n`
        })
    }
    this.escribirParrafo(texto)
  }

  private agregarParrafoLugarFunciones(datosFunciones: CondicionesContractuales): void {
    let texto = `SEGUNDO - Del lugar de prestaci??n de los servicios. `
    texto += `${this.DENOMINACION_TRABAJADOR} desempe??ar?? sus funciones en las instalaciones de `+
    `${this.DENOMINACION_EMPLEADOR} ubicadas en el domicilio: ${datosFunciones.direccionLabores}, `+
    `comuna ${datosFunciones.comunaLabores.nombre}, Regi??n ${datosFunciones.regionLabores.nombre}.`
    this.escribirParrafo(texto)
  }

  private agregarParrafoJornadaLaboral(datosJornada: CondicionesContractuales): void {
    //TODO: Agregar parrafo cuando tiene turno flexible
    const descripcionTipoJornada = store.obtenerDescripcionTipoJornada(datosJornada.jornada)
    let texto = `TERCERO - De la jornada de trabajo. ${this.DENOMINACION_TRABAJADOR} `+
    `cumplir?? una jornada de ${datosJornada.horasJornada} horas semanales, `+
    `distribuidas en ${descripcionTipoJornada}, `+
    `las cuales estar??n distribuidas de acuerdo a `
    if (datosJornada.jornada === RotacionTurnos.Reglamento) {
      texto += 'lo estipulado en el Reglamento Interno.'
    } else {
      texto += 'los siguientes horarios:\n'
      const horariosJornada = store.obtenerHorariosJornada(datosJornada.jornada)
      //TODO: Hacer funcion para parsear los turnos en una tabla
      for (const horario in horariosJornada) {
        texto += `\t${horariosJornada[horario as Turno]}\n`
      }
    }
    texto += '\nCuando por necesidades de funcionamiento de la empresa sea necesario pactar '+
    `trabajo en tiempo extraordinario, ${this.DENOMINACION_TRABAJADOR} que lo acuerde desde luego se obligar?? `+
    `a cumplir el horario que al efecto determine ${this.DENOMINACION_EMPLEADOR}, dentro de los l??mites legales. `+
    'Dicho acuerdo constar?? por escrito y se firmar?? por ambas partes, previamente a la realizaci??n del trabajo.'
    this.escribirParrafo(texto)
  }

  private agregarParrafoRemuneraciones(datosRemuneracion: CondicionesContractuales): void {
    const texto = `CUARTO - ${this.DENOMINACION_EMPLEADOR} se compromente a remunerar los servicios `+
      `de ${this.DENOMINACION_TRABAJADOR} con un sueldo mensual de $${datosRemuneracion.sueldoBase} `+
      `que ser?? liquidado y pagado, por per??odos vencidos y en forma proporcional a los d??as trabajados.\n\n`
      + `De la remuneraci??n se deducir??n los impuestos; las cotizaciones de previsi??n o seguridad social,`+
      `de salud, de seguro de cesant??a; y todas aquellas deducciones, con los topes legales se??alados en el `+
      `art??culo 54 y siguientes del C??digo del Trabajo, que el trabajador haya autorizado de manera expresa `+
      `mediante carta autorizaci??n firmada.`

      this.escribirParrafo(texto)
  }

  private agregarParrafoObligacionesTrabajador(): void {
    const texto = `QUINTO - ` +
    `Son obligaciones esenciales, de ${this.DENOMINACION_TRABAJADOR}, cuya infracci??n las partes entienden como causa justificada de terminaci??n del presente contrato, las siguientes:
    1.- Realizar su labor a plena satisfacci??n de su empleador manteniendo una permanente, oportuna y debida atenci??n de su cargo;
    2.- Cumplir con la mayor diligencia, cuidado y buena voluntad los deberes que le imponen sus funciones o labores;
    3.- Mantener la m??s absoluta confidencialidad y reserva de los antecedentes, documentos o informaci??n, cualquiera fuera su naturaleza, de que tome conocimiento en el desempe??o de los servicios encomendados, oblig??ndose a no revelarlos;
    4.- Guardar la m??s estricta reserva frente a terceros, respecto de los negocios del empleador;
    5.- Mantener una presentaci??n personal acorde con sus labores;
    6.- Informar y dar cuenta en forma permanente y oportuna a sus jefes sobre las labores que desarrolle, con todo detalle;
    7.- Cuidar y mantener, en perfecto estado de conservaci??n, las m??quinas, ??tiles y otros bienes de la empresa;
    8.- Cumplir las instrucciones y las ??rdenes que le imparta cualquiera de sus superiores;
    9.- En casos de inasistencia al trabajo, por enfermedad, el trabajador deber?? justificarla -??nicamente- con el correspondiente certificado m??dico, dentro del plazo de 24 horas, desde que aqu??l dej?? de asistir al trabajo;
    10.- Colaborar activamente, en todas aquellas tareas en que se desempe??e representando al empleador;
    11.- Informar a su jefe directo de cualquier anomal??a y eventual perjuicio que pudiere afectar al empleador que pudiere mitigarse o evitarse de conocerse;
    12.- En general toda conducta que pudiere perjudicar el nombre y/o prestigio del empleador
    `
    this.escribirParrafo(texto)
  }

  private agregarParrafoDuracionContrato(): void {
    // const originalFont = this.pdf.getFont()
    // this.pdf.setFont(originalFont.fontName, 'bold')
    const textoPlazoFijo = `El presente contrato durar?? hasta el _______ y solo podr?? pon??rsele t??rmino en conformidad a la legislaci??n vigente.`
    const textoIndefinido = `El presente contrato tendr?? el car??cter de contrato indefinido. Las partes pueden ponerle t??rmino de com??n acuerdo, `+
    `y una sola de ellas podr?? hacerlo en la forma, las condiciones y por las causales que se??alan los art??culos 159, 160 y 161 del C??digo del Trabajo.`
    this.escribirParrafo(`SEXTO - ${textoPlazoFijo}`)
  }

  private agregaParrafoFechaCelebracion() {
    const texto = "SEPTIMO - Se deja constancia que el trabajador ingres?? el _______"
    this.escribirParrafo(texto)
  }

  private agregarParrafoDomicilioJudicial(datosEmpleador: Empleador) {
    const texto = ` OCTAVO - Para todos los efectos derivados de este contrato, las partes fijan su domicilio en la comuna de ${datosEmpleador.comuna.nombre}`+
    ` y prorrogan competencia para ante sus tribunales de justicia. `
    this.escribirParrafo(texto)
  }

  private agregarParrafoEjemplares(): void {
    const texto = 'NOVENO - El presente contrato se firma en tres ejemplares de id??ntico tenor, declarando el trabajador haber recibido un ejemplar de ??l y que ??ste es fiel reflejo de la '+
      'relaci??n laboral existente entre las partes. Los otros dos ejemplares quedan en poder del empleador.'
    this.escribirParrafo(texto)
  }

  private agregarFirmas(contrato: ContratoTrabajo): void {
    let PosXActual = this.posActualCursorEnPDF.x
    this.moverCursorY(this.magnitudSaltoLinea*2)
    const dimensionFirma = this.crearFirma(contrato.empleador.rut, true, PosXActual)
    this.moverCursorX(dimensionFirma.ancho*2)
    PosXActual = this.posActualCursorEnPDF.x
    this.crearFirma(contrato.trabajador.run, false, PosXActual)
    this.moverCursorY(dimensionFirma.largo + this.magnitudSaltoLinea)
    this.resetearCursorX()
  }

  private crearFirma(rut: string, esEmpleador: boolean, x: number): {ancho: number, largo: number} {
    const anchoFirma = (this.pdf.getStringUnitWidth("FIRMA TRABAJADOR") + 1)*this.pdf.getFontSize()
    const PosYActual = this.posActualCursorEnPDF.y
    const quienFirma = esEmpleador? "FIRMA EMPLEADOR": "FIRMA TRABAJADOR"
    const lineaRut = esEmpleador? `RUT: ${rut}`: `RUN: ${rut}`
    this.pdf.line(x, PosYActual, x + anchoFirma, PosYActual)
    this.pdf.text(quienFirma, x, PosYActual + this.pdf.getLineHeight())
    this.pdf.text(lineaRut, x, PosYActual + this.pdf.getLineHeight()*2)
    const largoFirma = this.pdf.getLineHeight()*2
    return {
      ancho: anchoFirma,
      largo: largoFirma
    }
  }

  private agregarNotaFinesEducacionales() {
    this.pdf.setFontSize(this.fontSize*.8)
    const notaEducacional = 'Documento solo para fines educativos.'
    const mitadHorizontal = this.obtenerMitadHorizontalDePagina()
    const anchoNota = this.pdf.getStringUnitWidth(notaEducacional)*this.pdf.getFontSize()
    const PosX = mitadHorizontal - (anchoNota/2)
    const PosY = this.docInnerHeight+(this.pdf.getFontSize()/this.pdf.internal.scaleFactor)
    const paginasTotales = this.pdf.getNumberOfPages()
    for (let i = 1; i <= paginasTotales; i++) {
      this.pdf.setPage(i)
      this.pdf.text(notaEducacional, PosX, PosY)
    }
    this.pdf.setFontSize(this.fontSize)
  }

  private escribirParrafo(texto: string, debug?: boolean): void {
    if (texto) {
      const lineasDeTexto = this.pdf.splitTextToSize(texto, this.docInnerWidth)
      if (!this.hayEspacioEnPagina(lineasDeTexto)) {
        this.agregarPagina()
      }
      if (debug && lineasDeTexto && typeof lineasDeTexto === 'object') {
        let maxCaracteresPorLinea = 0;
        (<string[]>lineasDeTexto).forEach((linea) => {
          if (linea.length > maxCaracteresPorLinea) {
            maxCaracteresPorLinea = linea.length
          }
          console.log(`largo: ${linea.length}`)
        })
        console.log(`max: ${maxCaracteresPorLinea}`)
      }
      this.pdf.text(lineasDeTexto, this.posActualCursorEnPDF.x, this.posActualCursorEnPDF.y)
      this.moverCursorY(this.obtenerEspacioVerticalUsadoPorTexto(lineasDeTexto))
      this.moverCursorY(this.magnitudSaltoLinea*this.espacioEntreParrafos)
    }
  }
  private obtenerEspacioVerticalUsadoPorTexto(texto: string | string[]): number {
    const lineHeightFactor = this.pdf.getLineHeight()
    const lineasTexto = typeof texto === 'object'? texto.length: 1
    const espacioOcupado = lineHeightFactor * lineasTexto
    return espacioOcupado
  }

  private obtenerMitadHorizontalDePagina() {
    const mitadHorizontal = (this.docInnerWidth/this.pdf.internal.scaleFactor/2) + this.margenXDoc
    return mitadHorizontal
  }

  private resetearCursorX(): void {
    this.posActualCursorEnPDF.x = this.margenXDoc
  }

  private resetearCursorY(): void {
    this.posActualCursorEnPDF.y = this.margenYDoc + (this.fontSize/this.pdf.internal.scaleFactor)
  }

  private moverCursorX(offsetX: number): void {
      this.moverCursor({x: offsetX, y: 0})
    }

    private moverCursorY(offsetY: number): void {
      this.moverCursor({x: 0, y: offsetY})
    }

  private moverCursor(offset: CoordenadasCursor, debug?: boolean): void {
    if (debug) {
      console.log(`Posicion antes de movimiento: {x: ${this.posActualCursorEnPDF.x}, y: ${this.posActualCursorEnPDF.y}}`)
      console.warn(`Moviendo cursor: x:${offset.x} - y: ${offset.y}`)
    }
    this.posActualCursorEnPDF.x += offset.x
    this.posActualCursorEnPDF.y += offset.y
  }

  private hayEspacioEnPagina(lineasDeTexto: string | string[]): boolean {
    const largoTexto = this.obtenerEspacioVerticalUsadoPorTexto(lineasDeTexto)
    const espacioRestanteEnPagina = this.docInnerHeight - this.posActualCursorEnPDF.y
    const espacioDisponibleAlAgregarTexto = espacioRestanteEnPagina - largoTexto
    if (espacioDisponibleAlAgregarTexto > 0) {
      return true
    }
    return false
  }

  private agregarPagina(): void {
    this.pdf.addPage(this.format)
    this.resetearCursorY()
    this.resetearCursorX()
  }

  private mostrarInfoDebug(): void {
    this.mostrarMargenesPaginas()
  }

  private mostrarMargenesPaginas(): void {
    const colorOriginal = this.pdf.getDrawColor()
    this.pdf.setDrawColor(250,40,150)
    for (let i = 1; i <= this.pdf.getNumberOfPages(); i++) {
      this.pdf.setPage(i)
      //linea Superior
      this.pdf.line(this.margenXDoc, this.margenYDoc, this.margenXDoc + this.docInnerWidth, this.margenYDoc)
      //linea Inferior
      this.pdf.line(this.margenXDoc, this.docInnerHeight, this.margenXDoc + this.docInnerWidth, this.docInnerHeight)
      //linea Izquierda
      this.pdf.line(this.margenXDoc, this.margenYDoc, this.margenXDoc, this.docInnerHeight)
      //Linea Derecha
      this.pdf.line(this.margenXDoc + this.docInnerWidth, this.margenYDoc, this.margenXDoc + this.docInnerWidth, this.docInnerHeight)
    }
    this.pdf.setDrawColor(colorOriginal)
  }
  private Tests() {
    let x0 = this.pdf.internal.pageSize.width/2
    const y0 = 0
    let x1 = this.pdf.internal.pageSize.width/2
    const y1 = this.pdf.internal.pageSize.height
    this.pdf.setLineWidth(2)
    this.pdf.setDrawColor(207,13,40)
    this.pdf.line(x0, y0, x1, y1)
    this.pdf.setDrawColor(20,189,40)
    x0 = this.obtenerMitadHorizontalDePagina()
    x1 = this.obtenerMitadHorizontalDePagina()
    this.pdf.line(x0, y0, x1, y1)
    this.pdf.setLineWidth(1)
  }
}

export default PDFContrato
