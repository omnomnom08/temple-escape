#target photoshop

app.displayDialogs = DialogModes.NO;

var sourcePath = "D:/Test_Task/gta-home-task-rm/temple-escape/assets/art/design.psd";
var stagingPath = "D:/Test_Task/gta-home-task-rm/temple-escape/assets/art/layers/_psd_reextract_staging";
var manifestPath = stagingPath + "/manifest.tsv";
var donePath = stagingPath + "/DONE.txt";
var failedPath = stagingPath + "/FAILED.txt";

function sanitizeName(name) {
    var value = String(name);
    value = value.replace(/\s+/g, "_");
    value = value.replace(/[\\\/:*?\"<>|!]/g, "");
    value = value.replace(/_+/g, "_");
    value = value.replace(/^_+|_+$/g, "");
    value = value.replace(/[. ]+$/g, "");
    return value.length ? value : "unnamed_layer";
}

function safeText(value) {
    return String(value).replace(/\t/g, " ").replace(/\r?\n/g, " ");
}

function layerPath(layer) {
    var parts = [safeText(layer.name)];
    var parent = layer.parent;
    while (parent && parent.typename === "LayerSet") {
        parts.unshift(safeText(parent.name));
        parent = parent.parent;
    }
    return parts.join("/");
}

function collectArtLayers(container, output) {
    for (var i = 0; i < container.layers.length; i++) {
        var layer = container.layers[i];
        if (layer.typename === "LayerSet") {
            collectArtLayers(layer, output);
        } else if (layer.typename === "ArtLayer") {
            output.push(layer);
        }
    }
}

function writeFailure(message) {
    var file = new File(failedPath);
    file.encoding = "UTF8";
    file.open("w");
    file.write(message);
    file.close();
}

var stagingFolder = new Folder(stagingPath);
if (!stagingFolder.exists && !stagingFolder.create()) {
    throw new Error("Could not create staging folder: " + stagingPath);
}

try {
    var doc = app.open(new File(sourcePath));
    var layers = [];
    var nameCounts = {};
    var manifest = ["output_name\toriginal_name\tlayer_path\tleft\ttop\tright\tbottom\twidth\theight\tkind"];
    var exported = 0;
    var skipped = 0;
    collectArtLayers(doc, layers);

    for (var i = 0; i < layers.length; i++) {
        var sourceLayer = layers[i];
        var bounds;
        try {
            bounds = sourceLayer.bounds;
        } catch (boundsError) {
            skipped++;
            continue;
        }

        var left = Math.floor(bounds[0].as("px"));
        var top = Math.floor(bounds[1].as("px"));
        var right = Math.ceil(bounds[2].as("px"));
        var bottom = Math.ceil(bounds[3].as("px"));
        var width = right - left;
        var height = bottom - top;
        if (width <= 0 || height <= 0) {
            skipped++;
            continue;
        }

        var baseName = sanitizeName(sourceLayer.name);
        var key = baseName.toLowerCase();
        nameCounts[key] = (nameCounts[key] || 0) + 1;
        var outputBase = baseName;
        if (nameCounts[key] > 1) {
            outputBase += "__" + nameCounts[key];
        }
        var outputName = outputBase + ".png";

        var exportDoc = app.documents.add(UnitValue(width, "px"), UnitValue(height, "px"), doc.resolution, outputBase, NewDocumentMode.RGB, DocumentFill.TRANSPARENT);
        app.activeDocument = doc;
        var duplicate = sourceLayer.duplicate(exportDoc, ElementPlacement.PLACEATBEGINNING);
        app.activeDocument = exportDoc;
        duplicate.visible = true;
        var duplicateBounds = duplicate.bounds;
        duplicate.translate(-duplicateBounds[0].as("px"), -duplicateBounds[1].as("px"));

        var options = new PNGSaveOptions();
        options.compression = 9;
        options.interlaced = false;
        exportDoc.saveAs(new File(stagingPath + "/" + outputName), options, true, Extension.LOWERCASE);
        exportDoc.close(SaveOptions.DONOTSAVECHANGES);
        app.activeDocument = doc;

        manifest.push([
            outputName,
            safeText(sourceLayer.name),
            layerPath(sourceLayer),
            left,
            top,
            right,
            bottom,
            width,
            height,
            sourceLayer.kind
        ].join("\t"));
        exported++;
    }

    var manifestFile = new File(manifestPath);
    manifestFile.encoding = "UTF8";
    manifestFile.open("w");
    manifestFile.write(manifest.join("\n"));
    manifestFile.close();

    doc.close(SaveOptions.DONOTSAVECHANGES);
    var doneFile = new File(donePath);
    doneFile.encoding = "UTF8";
    doneFile.open("w");
    doneFile.write("exported=" + exported + "\nskipped=" + skipped + "\ntotal_art_layers=" + layers.length);
    doneFile.close();
} catch (error) {
    writeFailure(error.message + "\nline=" + error.line);
}

app.quit();
