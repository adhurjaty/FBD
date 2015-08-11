var height = 500;
var width = 1000;
var border = 1;

var fbdHeight = 200;
var fbdWidth = 400;
var fbdBorderColor = 'steelblue';
var fbdBorder = 1;

var momentWidth = 40;

var imgList = ['img/force_img.png', 'img/moment_img.png', 'img/roller_img.png',
               'img/pin_img.png', 'img/cantilever_img.png'];
var toolList = [['force', arrow], ['moment', moment], ['roller', rollerJoint],
                ['pin', pinJoint], ['cantilever', cantileverJoint]];
var moveFnc = {'force': moveArrow, 'label': moveLabel, 'pin': movePinJoint, 'moment': moveMoment,
                       'roller': moveRollerJoint, 'cantilever': moveCantilever};
var toolSize = 50;
var toolSpacing = 5;
var toolX = width - toolSpacing - toolSize;
var toolIndex = 0;
var toolInputs = [
                  {orient: {cartesian: ['Fx: ', 'Fy: '], spherical: ['Mag: ', '&theta;:']}},
                  {orient: {cartesian: null, spherical: null}},
                  {orient: {cartesian: ['Fx: ', 'Fy: '], spherical: ['&theta;: ']}},
                  {orient: {cartesian: null, spherical: null}},
                  {orient: {cartesian: null, spherical: null}},
                 ];
var toolSelectionRect = [];
var selectedWidth = 3;
var unselectedWidth = .5;
var selectedColor = 'green';

// int that is used to temporarily change the tool index and track the previous tool index for editCallback
var tempToolIndex = -1;

var dialogHeight = 320;
var dialogWidth = 260;
var dialogBorder = 1;
var dialogBorderColor = 'black';

var pinJointWidth = 20;

var imageHeight = 100;
var imageWidth = dialogWidth - 10;
var placeholderImage = 'https://placehold.it/' + imageWidth + 'x' + imageHeight;

var fbdCoordsMax = {x: 1.0, y: 1.0, z: 1.0};

// array to keep track of all things placed on fbd
var assets = []

// moment asset is special in that it never moves once placed and is only added or subtracted value
// once another moment is placed
var momentAsset = null;

//var inputs = [$('input[name=dialogField1]'), $('input[name=dialogField2]'), $('input[name=dialogField3]')];
var inputSpacing = 5;

var viewModel = {
    orient: ko.observable(true),
    moment: ko.observable(false),
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
    editObj: ko.observable(null),
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
    if(tempToolIndex != -1) {
        tool(tempToolIndex);
        tempToolIndex = -1;
    }
    hideDialog();
}

function placeBtn() {
    var vecX = parseFloat(viewModel.orientInputs()[0]().value);
    var vecY = parseFloat(viewModel.orientInputs()[1]().value);
    var posX = parseFloat(viewModel.posInputs()[0]().value);
    var posY = parseFloat(viewModel.posInputs()[1]().value);

    resizeFbd(posX, posY);

    if(viewModel.editObj() == null) {
        var tempObj = {}
        tempObj[tool()[0]] = tool()[1](posX, posY, vecX, vecY);
        assets.push(tempObj);
        //assets.push({'label': placeLabel(posX, posY)})
    } else {
        var key = Object.keys(viewModel.editObj())[0]
        moveFnc[key](viewModel.editObj()[key], fbdToSvgCoords(posX, posY).concat([vecX, vecY]));

        //set the toolIndex back to the previous value
        tool(tempToolIndex);
        tempToolIndex = -1;
    }

    hideDialog();
}


function resizeFbd(x, y) {
    if(x > fbdCoordsMax.x || y > fbdCoordsMax.y) {
        fbdCoordsMax.x = Math.max(x+.1, fbdCoordsMax.x);
        fbdCoordsMax.y = Math.max(y+.1, fbdCoordsMax.y);

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
        
        toolSelectionRect[toolIndex].style('stroke', 'black')
                                    .style('stroke-width', unselectedWidth)
        toolIndex = index;

        toolSelectionRect[toolIndex].style('stroke', selectedColor)
                                    .style('stroke-width', selectedWidth)

        viewModel.orient(toolInputs[index].orient.cartesian != null);
        viewModel.moment(index == 1);

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


function popDialog(el, index) {

    viewModel.editObj(null);
    dialogHelper(index, d3.mouse(this)[0] - 40, d3.mouse(this)[1] - 40)

    // put clicked position coords in popped dialog
    updateArray(viewModel.posInputs(), 'value',
                svgToFbdCoords(d3.mouse(this)[0].toFixed(2), d3.mouse(this)[1].toFixed(2)).concat(''));    
}


function editCallback(el, index) {
    return function() {
        var tempObj = {}
        tempObj[toolList[index][0]] = el;

        tempToolIndex = toolIndex;
        tool(index);

        viewModel.editObj(tempObj);
        dialogHelper(index, parseFloat(el.attr('x')), parseFloat(el.attr('y')));
        updateArray(viewModel.posInputs(), 'value', [el.attr('absPosX'), el.attr('absPosY'), ''])
        updateArray(viewModel.orientInputs(), 'value', [el.attr('xVec'), el.attr('yVec'), ''])
    }
}


function dialogHelper(index, x, y) {
    
    if(y + dialogHeight > height) {
        y = height - dialogHeight;
    }

    toolDialog.attr('x', x)
              .attr('y', y)
              .style('visibility', 'visible');

    /*
    viewModel.orientInputs(toolInputs[toolIndex].orient.cartesian.map(function(d) {
        return {'label': d, 'value': ''};
    }));
    */

    var absX = x + svg.node().offsetLeft;
    var absY = y + svg.node().offsetTop;
    var inputPosX = 0;
    var inputPosY = 0;

    //Knockout.js way of moving dialog box
    viewModel.dialogVisibility(true);
    viewModel.dialogX(absX + inputPosX + 'px');
    viewModel.dialogY(absY + inputPosY + 'px');
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
       .attr('width', toolSize);

    toolSelectionRect.push(svg.append('rect')
                              .attr('x', toolX)
                              .attr('y', i*toolSize + (i+1)*toolSpacing)
                              .attr('height', toolSize)
                              .attr('width', toolSize)
                              .style('fill', 'transparent')
                              .style('stroke', i == 0 ? selectedColor : 'black')
                              .style('stroke-width', i == 0 ? selectedWidth : unselectedWidth)
                              .on('click', toolCallback(i)));
}

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
    if(![posX, posY, xVec, yVec].every(function(d) { return !isNaN(d); })) {
        throw 'Show Error'
    }
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


function moment(n1, n2, mag) {
    // n1 and n2 are unused parameters there only to make the function call in 'placeBtn' work

    if(momentAsset == null) {
        var pos = fbdToSvgCoords(fbdCoordsMax.x/2, fbdCoordsMax.y/2).map(function(d, i) {
            return d - momentWidth/2;
        });
        momentAsset = svg.append('image')
                         .attr('xlink:href', imgList[1])
                         .attr('x', pos[0])
                         .attr('y', pos[1])
                         .attr('height', momentWidth)
                         .attr('width', momentWidth)
                         .attr('xVec', mag)
        momentAsset.on('click', editCallback(momentAsset, 1));
        
    } else
        momentAsset.attr('xVec', mag + parseFloat(momentAsset.attr('xVec')))

    momentAsset.attr('transform', '');
    if(parseFloat(momentAsset.attr('xVec')) < 0) {
        momentAsset.attr('transform', 'scale(-1,1) translate(' +
                        (-momentWidth - 2*parseFloat(momentAsset.attr('x'))) + ',0)');
    }
    
}

function moveMoment(moment, magArray) {
    var mag = magArray[2];
    moment.attr('transform', '');

    moment.attr('xVec', mag);
    if(mag < 0) {
        moment.attr('transform', 'scale(-1,1) translate(' +
                        (-momentWidth - 2*parseFloat(moment.attr('x'))) + ',0)');
    }
}


function pinJoint(posX, posY) {
    if(![posX, posY].every(function(d) { return !isNaN(d); })) {
        throw 'Show Error'
    }
    return jointHelper(posX, posY, 0, 1, 3);
}


function movePinJoint(joint, newPos) {
    moveHelper(joint, newPos);
}


function rollerJoint(posX, posY, xVec, yVec) {
    if(![posX, posY, xVec, yVec].every(function(d) { return !isNaN(d); })) {
        throw 'Show Error'
    }
    var joint = jointHelper(posX, posY, xVec, yVec, 2);
    joint.attr('xVec', xVec).attr('yVec', yVec);
    return joint;
}


function moveRollerJoint(joint, newPos) {
    moveHelper(joint, newPos);
}


function cantileverJoint(posX, posY) {
    if(![posX, posY].every(function(d) { return !isNaN(d); })) {
        throw 'Show Error'
    }
    return jointHelper(posX, posY, 0, 1, 4);
}


function moveCantilever(joint, newPos) {
    moveHelper(joint, newPos);
}


function jointHelper(posX, posY, xVec, yVec, index) {
    var theta = Math.atan2(yVec, xVec) * 180/Math.PI;
    var width = 30;

    var pos = fbdToSvgCoords(posX, posY);

    var joint = svg.append('image')
              .attr('xlink:href', imgList[index])
              .attr('x', pos[0] - width/2)
              .attr('y', pos[1])
              .attr('height', width)
              .attr('width', width)
              .attr('absPosX', posX)
              .attr('absPosY', posY);
    rotateImage(joint, pos, theta);
    joint.on('click', editCallback(joint, index));
    return joint;
}


function moveHelper(joint, newPos) {
    joint.attr('x', newPos[0] - parseFloat(joint.attr('width'))/2)
         .attr('y', newPos[1]);
    if(newPos.length == 4) {
        rotateImage(joint, newPos.slice(0, 2), Math.atan2(newPos[3], newPos[2]) * 180/Math.PI);
        joint.attr('xVec', newPos[2]).attr('yVec', newPos[3]);
    }
}

function rotateImage(imageEl, origin, theta) {
    imageEl.attr('transform', 'rotate(' + (90 - theta) + ',' + origin[0] + ',' + origin[1] + ')');
}

var originLabel = placeLabel(0,0);
var maxLabel = placeLabel(1,1);