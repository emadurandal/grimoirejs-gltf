import TransformComponent from "grimoirejs-fundamental/ref/Components/TransformComponent";
import GLTFNode from "../Parser/Schema/GLTFNode";
import Animation from "../Animation/Animation";
import Matrix from "grimoirejs-math/ref/Matrix";
import GomlNode from "grimoirejs/ref/Node/GomlNode";
import ParsedGLTF from "../Parser/ParsedGLTF";
import Component from "grimoirejs/ref/Node/Component";
import IAttributeDeclaration from "grimoirejs/ref/Node/IAttributeDeclaration";
import GLTFParser from "../Parser/Parser";


export default class GLTFModelComponent extends Component {

  public static componentName: string = "GLTFModelComponent";

  public static attributes: { [key: string]: IAttributeDeclaration } = {
    src: {
      converter: "String",
      defaultValue: null
    },
    scene: {
      converter: "String",
      defaultValue: null
    }
  };

  public $mount(): void {
    const src = this.getValue("src");
    if (src) {
      const gl: WebGLRenderingContext = this.companion.get("gl") as WebGLRenderingContext;
      GLTFParser.parseFromURL(gl, src).then((data) => {
        this._populateAssets(data);
        this._populateScene(data);
      });
    }
  }

  private _populateScene(data: ParsedGLTF): void {
    let sceneName = this.getValue("scene");
    if (!sceneName) {
      sceneName = data.tf.scene;
    }
    const sceneNodes = data.tf.scenes[sceneName];
    for (let nodeName of sceneNodes.nodes) {
      this._populateNode(data, nodeName, this.node);
    }
  }

  private _populateAssets(data: ParsedGLTF): void {
    const assetRoot = this.node.addChildByName("gltf-assets", {});
    for (let key in data.materials) {
      //data.materials[key]["boneMatricies"] = data.skins["Armature_Cylinder-skin"].jointMatrices;
      const node = assetRoot.addChildByName("material", data.materials[key]);
      node.element.className = data.materials[key]["class"]; // hack for bug
    }
    for (let key in data.animations) {
      assetRoot.addChildByName("gltf-animation", {
        animation: data.animations[key]
      });
    }
  }

  private _populateNode(data: ParsedGLTF, nodeName: string, parentNode: GomlNode): void {
    const node = data.tf.nodes[nodeName];
    const gomlNode = parentNode.addChildByName("object", {});
    gomlNode.element.className = nodeName;
    if (node.meshes !== void 0) {
      for (let i = 0; i < node.meshes.length; i++) {
        const mesh = data.meshes[node.meshes[i]];
        for (let j = 0; j < mesh.length; j++) {
          gomlNode.addChildByName("gltf-mesh", {
            geometry: mesh[j],
            material: ".gltf-" + data.tf.meshes[node.meshes[i]].primitives[j].material,
            boneMatricies: node.skin ? data.skins[node.skin].jointMatrices : undefined
          });
        }
      }
    }
    this._applyTransform(node, gomlNode);
    if (node.children) {
      for (let chNodeName of node.children) {
        this._populateNode(data, chNodeName, gomlNode);
      }
    }
    if (node.skeletons && node.skin) {
      for (let i = 0; i < node.skeletons.length; i++) {
        const jointNode = this.node.getChildrenByClass(node.skeletons[i]);
        this._injectJoint(data, jointNode[0], node.skeletons[i], this.node.getComponent(TransformComponent), node.skin);
      }
    }
  }

  private _injectJoint(data: ParsedGLTF, gomlNode: GomlNode, nodeName: string, skeletonTransform: TransformComponent, skinName: string): void {
    gomlNode.addComponent("GLTFJoint", {
      skinInfo: data.skins[skinName],
      jointName: nodeName,
      skeletonTransform: skeletonTransform,
      jointMatrices: data.skins[skinName].jointMatrices
    });
    if (data.tf.nodes[nodeName].children) {
      const node = data.tf.nodes[nodeName];
      for (let i = 0; i < node.children.length; i++) {
        const jointNode = this.node.getChildrenByClass(node.children[i]);
        this._injectJoint(data, jointNode[0], node.children[i], skeletonTransform, skinName);
      }
    }
  }



  private _applyTransform(node: GLTFNode, gomlNode: GomlNode): void {
    if (node.translation) {
      gomlNode.setAttribute("position", node.translation);
    }
    if (node.scale) {
      gomlNode.setAttribute("scale", node.scale);
    }
    if (node.rotation) {
      gomlNode.setAttribute("rotation", node.rotation);
    }
    if (node.matrix) {
      const mat = new Matrix(node.matrix);
      gomlNode.setAttribute("position", mat.getTranslation());
      gomlNode.setAttribute("scale", mat.getScaling());
      gomlNode.setAttribute("rotation", mat.getRotation());
    }
  }
}
