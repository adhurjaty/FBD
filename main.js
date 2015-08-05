var height = 500;
var width = 1000;
var border = 1;

var fbdHeight = 200;
var fbdWidth = 400;
var fbdBorderColor = 'steelblue';
var fbdBorder = 1;

var toolList2 = ['red', 'blue', 'green', 'orange', 'black'];
var imgList = ['img/force_img.png', 'img/moment_img.png', 'img/roller_img.png',
               'img/pin_img.png', 'img/cantilever_img.png'];
var toolList = [['force', arrow], ['moment', moment], ['roller', rollerJoint],
                ['pin', pinJoint], ['cantilever', cantileverJoint]];
var toolSize = 50;
var toolSpacing = 5;
var toolX = width - toolSpacing - toolSize;
var toolIndex = 0;
var toolInputs = [
                  {orient: {cartesian: ['Fx: ', 'Fy: ', 'Fz: '], spherical: ['Mag: ', '&theta;: ', '&phi;: ']}},
                  {orient: {cartesian: ['Fx: ', 'Fy: ', 'Fz: '], spherical: ['Mag: ', '&theta;: ', '&phi;: ']}},
                  {orient: {cartesian: ['Fx: ', 'Fy: ', 'Fz: '], spherical: ['&theta;: ', '&phi;: ']}},
                  {orient: {cartesian: null, spherical: null}},
                  {orient: {cartesian: null, spherical: null}},
                 ];

var dialogHeight = 320;
var dialogWidth = 250;
var dialogBorder = 1;
var dialogBorderColor = 'black';

var pinJointWidth = 20;

var imageHeight = 100;
var imageWidth = dialogWidth - 10;
var placeholderImage = 'https://placehold.it/' + imageWidth + 'x' + imageHeight;

var fbdCoordsMax = {x: 1.0, y: 1.0, z: 1.0};

// array to keep track of all things placed on fbd
var assets = []

//var inputs = [$('input[name=dialogField1]'), $('input[name=dialogField2]'), $('input[name=dialogField3]')];
var inputSpacing = 5;

var viewModel = {
    orient: ko.observable(true),
    posInputs: ko.observableArray([ko.observable({label: 'X: ', value: ''}),
                                ko.observable({label: 'Y: ', value: ''}),
                                ko.observable({label: 'Z: ', value: ''})]),
    orientInputs: ko.observableArray([ko.observable({label: 'Fx: ', value: ''}),
                                      ko.observable({label: 'Fy: ', value: ''}),
                                      ko.observable({label: 'Fz: ', value: ''})]),
    dialogHeight: ko.observable(dialogHeight + 'px'),
    dialogWidth: ko.observable(dialogWidth + 'px'),
    dialogX: ko.observable('0px'),
    dialogY: ko.observable('0px'),
    dialogVisibility: ko.observable(false),
    imgSrc: ko.observable(placeholderImage),
    cartesian: ko.observable(true),
    changeCoords: function(data, event) {
        if($(event.toElement).html() == 'Spherical') {
            this.cartesian(false);
            updateArray(this.orientInputs(), 'label', toolInputs[toolIndex].orient.spherical);
        } else {
            this.cartesian(true);
            updateArray(this.orientInputs(), 'label', toolInputs[toolIndex].orient.cartesian);
        }
    }
}

ko.applyBindings(viewModel);


function updateArray(array, field, new_vals) {
    for(var i = 0; i < new_vals.length; i++){
        var new_val = array[i]();
        new_val[field] = new_vals[i]
        array[i](new_val);
    }
}


function interpolate(from_min, from_max, to_min, to_max, x) {
    if((from_min <= x && x <= from_max) || (from_max <= x && x <= from_min))
        return (x - from_min) * (to_max - to_min) / (from_max - from_min) + to_min;
    //throw 'Coordinate out of bounds Exception';
    console.log('Outside of FBD bounds');
}


function svgToFbdCoords(x, y) {
    var rectX = parseInt(fbd.attr('x'));
    var rectY = parseInt(fbd.attr('y'));

    return [interpolate(rectX, rectX + fbdWidth, 0, fbdCoordsMax.x, x),
            interpolate(rectY + fbdHeight, rectY, 0, fbdCoordsMax.y, y)];
}


function fbdToSvgCoords(x, y) {
    var rectX = parseInt(fbd.attr('x'));
    var rectY = parseInt(fbd.attr('y'));

    return [interpolate(0, fbdCoordsMax.x, rectX, rectX + fbdWidth, x),
            interpolate(0, fbdCoordsMax.y, rectY + fbdHeight, rectY, y)];
}


function hideDialog() {
    toolDialog.style('visibility', 'hidden');
    viewModel.dialogVisibility(false);
}

function cancelBtn() {
    hideDialog();
}

function placeBtn() {
    var vecX = parseFloat(viewModel.orientInputs()[0]().value);
    var vecY = parseFloat(viewModel.orientInputs()[1]().value);
    var posX = parseFloat(viewModel.posInputs()[0]().value);
    var posY = parseFloat(viewModel.posInputs()[1]().value);

    if(isNaN(posX) || isNaN(posY) || (viewModel.orient() && (isNaN(vecX) || isNaN(vecY)))) {
        console.log('Show Error');
        return;
    }

    resizeFbd(posX, posY);

    var tempObj = {}
    tempObj[tool()[0]] = tool()[1](posX, posY, vecX, vecY);
    assets.push(tempObj);
    //assets.push({'label': placeLabel(posX, posY)})

    hideDialog();
}


function resizeFbd(x, y) {
    if(x > fbdCoordsMax.x || y > fbdCoordsMax.y) {
        fbdCoordsMax.x = Math.max(x+.1, fbdCoordsMax.x);
        fbdCoordsMax.y = Math.max(y+.1, fbdCoordsMax.y);
        var moveFnc = {'force': moveArrow, 'label': moveLabel};

        for(var a of assets) {
            var assetType = Object.keys(a)[0];
            var newPos = fbdToSvgCoords(a[assetType].attr('absPosX'), a[assetType].attr('absPosY'));
            moveFnc[assetType](a[assetType], newPos);
        }

        maxLabel.text('(' + fbdCoordsMax.x + ', ' + fbdCoordsMax.y + ')');
    }
}

function tool(index) {
    //function gets (no parameter specified) and sets (index specified) which tool is selected
    if(index !== undefined) {
        if(index >= toolList.length) {
            throw 'Tool Index Out of Bounds';
        }
        toolIndex = index;

        if(toolInputs[index].orient.cartesian == null) {
            viewModel.orient(false);
        } else {
            viewModel.orient(true);
        }

        return toolList[index];
    } else {
        return toolList[toolIndex];
    }

}

function toolCallback(i) {
    return function() {
        tool(i);
    }
}

function placeDot(element, index) {
    var x = d3.mouse(this)[0];
    var y = d3.mouse(this)[1];

    svg.append('circle')
       .attr('cx', x)
       .attr('cy', y)
       .attr('r', 5)
       .attr('fill', toolList[toolIndex]);
}

function popDialog(el, index) {
    var x = d3.mouse(this)[0] - 40;
    var y = d3.mouse(this)[1] - 40;

    if(y + dialogHeight > height) {
        y = height - dialogHeight;
    }

    toolDialog.attr('x', x)
              .attr('y', y)
              .style('visibility', 'visible');

    // put clicked position coords in popped dialog
    updateArray(viewModel.posInputs(), 'value', svgToFbdCoords(d3.mouse(this)[0], d3.mouse(this)[1]).concat(''));

    var absX = x + svg.node().offsetLeft;
    var absY = y + svg.node().offsetTop;
    var inputPosX = 0;
    var inputPosY = 0;

    //Knockout.js way of moving dialog box
    viewModel.dialogVisibility(true);
    viewModel.dialogX(absX + inputPosX + 'px');
    viewModel.dialogY(absY + inputPosY + 'px')
    
}

//create the svg element
var svg = d3.select('#drawing')
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .attr('border', 1);

//create the free body diagram rectangle
var fbd = svg.append('rect')
             .attr('x', (width-fbdWidth)/2)
             .attr('y', (height-fbdHeight)/2)
             .attr('height', fbdHeight)
             .attr('width', fbdWidth)
             .style('stroke', fbdBorderColor)
             .style('fill', 'transparent')
             .style('stroke-width', fbdBorder)
             .on('click', popDialog);

// create origin circle
var origin = svg.append('circle')
                .attr('cx', fbd.attr('x'))
                .attr('cy', parseInt(fbd.attr('y')) + fbdHeight)
                .attr('r', 5)
                .style('fill', 'transparent')
                .style('stroke', fbdBorderColor)
                .style('stroke-width', fbdBorder);

//create the tool selectors
for(var i=0; i < toolList.length; i++) {
    svg.append('image')
       .attr('xlink:href', imgList[i])
       .attr('x', toolX)
       .attr('y', i*toolSize + (i+1)*toolSpacing)
       .attr('height', toolSize)
       .attr('width', toolSize)
       .on('click', toolCallback(i))
}
/*
for(var i=0; i < toolList.length; i++) {
    svg.append('rect')
       .attr('x', toolX)
       .attr('y', i*toolSize + (i+1)*toolSpacing)
       .attr('height', toolSize)
       .attr('width', toolSize)
       .style('fill', toolList2[i])
       .on('click', toolCallback(i));
}
*/

//create the tool dialog rectangle and hide it. It only is visible when a tool is placed
var toolDialog = svg.append('rect')
                    .attr('x', 0)
                    .attr('y', 0)
                    .attr('height', dialogHeight)
                    .attr('width', dialogWidth)
                    .style('stroke', dialogBorderColor)
                    .style('stroke-width', dialogBorder)
                    .style('fill', 'white')
                    .style('visibility', 'hidden');

//create the svg border
var borderPath = svg.append('rect')
                    .attr('x', 0)
                    .attr('y', 0)
                    .attr('height', height)
                    .attr('width', width)
                    .style('stroke', 'black')
                    .style('fill', 'none')
                    .style('stroke-width', border);

//create the arrow head for the force arrows
var arrow_head = svg.append('marker')
                    .attr('xmlns', "http://www.w3.org/2000/svg")
                    .attr('id', "triangle")
                    .attr('viewBox', "0 0 10 10")
                    .attr('refX', 0)
                    .attr('refY', "5")
                    .attr('markerUnits', "strokeWidth")
                    .attr('markerWidth', 4)
                    .attr('markerHeight', 3)
                    .attr('orient', "auto");
arrow_head.append('path')
      .attr('d', "M 0 0 L 10 5 L 0 10 z");

function arrow(posX, posY, xVec, yVec) {
    pos = fbdToSvgCoords(posX, posY);
    return line = svg.append('line')
                  .attr('x1', pos[0] - xVec)
                  .attr('y1', pos[1] + yVec)
                  .attr('x2', pos[0])
                  .attr('y2', pos[1])
                  .attr('xVec', xVec)
                  .attr('yVec', yVec)
                  .attr('absPosX', posX)
                  .attr('absPosY', posY)
                  .attr('marker-end', 'url(#triangle)')
                  .attr('stroke', 'black')
                  .attr('stroke-width', 2);
}


function moveArrow(arr, newPos) {
    // void function - moves arrow (arr) to specified location in svg coordinates
    arr.attr('x1', newPos[0] - parseFloat(arr.attr('xVec')))
       .attr('y1', newPos[1] + parseFloat(arr.attr('yVec')))
       .attr('x2', newPos[0])
       .attr('y2', newPos[1]);
}


function placeLabel(x, y) {
    // places a coordinate label under specified location
    // x and y given in fbd coords
    var text = '(' + x + ', ' + y + ')';
    var coords = fbdToSvgCoords(x, y);
    //offset of label is above point if in top half of fbd
    var offset = y < fbdCoordsMax.y/2 ? 20 : -10;
    
    return svg.append('text')
              .text(text)
              .attr('x', coords[0])
              .attr('y', coords[1] + offset)
              .attr('absPosX', x)
              .attr('absPosY', y)
              .attr('text-anchor', 'middle');
}


function moveLabel(label, newPos) {
    label.attr('x', newPos[0])
         .attr('y', newPos[1]);
}


function moment() {

}


function pinJoint(posX, posY) {
    pos = fbdToSvgCoords(posX, posY);
    return svg.append('polygon')
                  .attr('points', pos[0] + ',' + pos[1] + ' ' + (pos[0]+pinJointWidth/2) +
                        ',' + (pos[1]+pinJointWidth) + ' ' + (pos[0]-pinJointWidth/2) +
                        ',' + (pos[1]+pinJointWidth))
                  .attr('absPosX', posX)
                  .attr('absPosY', posY)
                  .style('fill', 'black');
}


function movePinJoint(joint, newPos) {
    joint.attr('points', newPos[0] + ',' + newPos[1] + ' ' + (newPos[0]+pinJointWidth/2) +
                        ',' + (newPos[1]+pinJointWidth) + ' ' + (newPos[0]-pinJointWidth/2) +
                        ',' + (newPos[1]+pinJointWidth));
}


function rollerJoint(posX, posY, xVec, yVec) {

}


function cantileverJoint(posX, posY) {

}

var originLabel = placeLabel(0,0);
var maxLabel = placeLabel(1,1);