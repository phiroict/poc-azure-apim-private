cdk_get:
	cdktf get
cdk_deploy:
	cdktf synth && cdktf deploy --auto-approve
cdk_destroy:
	cdktf destroy --auto-approve
	az apim deletedservice purge --service-name phiroapimdemomtfv1 --location eastus
